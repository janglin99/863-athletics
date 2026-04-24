import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"
import { Seam } from "seam"

async function generateAccessCodesForBooking(
  bookingId: string,
  supabase: any
) {
  if (!process.env.SEAM_API_KEY || !process.env.SEAM_IGLOOHOME_DEVICE_ID) return

  const seam = new Seam({ apiKey: process.env.SEAM_API_KEY })
  const deviceId = process.env.SEAM_IGLOOHOME_DEVICE_ID

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, slots:booking_slots(*)")
    .eq("id", bookingId)
    .single()

  if (!booking) return

  const slots = (booking.slots || [])
    .filter((s: any) => s.status !== "cancelled")
    .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  if (slots.length === 0) return

  // Merge consecutive slots into sessions
  const sessions: { start: Date; end: Date; slotId: string }[] = []
  let cur = { start: new Date(slots[0].start_time), end: new Date(slots[0].end_time), slotId: slots[0].id }

  for (let i = 1; i < slots.length; i++) {
    const slotStart = new Date(slots[i].start_time)
    if (slotStart.getTime() === cur.end.getTime()) {
      cur.end = new Date(slots[i].end_time)
    } else {
      sessions.push(cur)
      cur = { start: new Date(slots[i].start_time), end: new Date(slots[i].end_time), slotId: slots[i].id }
    }
  }
  sessions.push(cur)

  for (const session of sessions) {
    try {
      const startsAt = new Date(session.start.getTime() - 30 * 60000)
      const endsAt = new Date(session.end.getTime() + 30 * 60000)

      const accessCode = await seam.accessCodes.create({
        device_id: deviceId,
        name: `863-${booking.booking_number}-${session.slotId.slice(0, 8)}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        is_offline_access_code: true,
      })

      await supabase.from("access_codes").insert({
        booking_id: bookingId,
        booking_slot_id: session.slotId,
        pin_code: accessCode.code || "GENERATING",
        seam_access_code_id: accessCode.access_code_id,
        seam_device_id: deviceId,
        valid_from: session.start.toISOString(),
        valid_until: session.end.toISOString(),
        status: accessCode.code ? "active" : "pending",
      })
    } catch (error: any) {
      await supabase.from("access_codes").insert({
        booking_id: bookingId,
        booking_slot_id: session.slotId,
        pin_code: "MANUAL_REQUIRED",
        valid_from: session.start.toISOString(),
        valid_until: session.end.toISOString(),
        status: "failed",
        error_message: error.message,
      })
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Get booking and payment
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, payments(*)")
      .eq("id", id)
      .eq("customer_id", user.id)
      .single()

    if (!booking)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    // Already confirmed
    if (booking.status === "confirmed") {
      return NextResponse.json({ booking })
    }

    // Find the payment with a Stripe PI
    const payment = booking.payments?.find(
      (p: any) => p.stripe_payment_intent_id
    )

    if (!payment) {
      return NextResponse.json(
        { error: "No payment found" },
        { status: 400 }
      )
    }

    // Verify with Stripe that the payment actually succeeded
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const pi = await stripe.paymentIntents.retrieve(
      payment.stripe_payment_intent_id
    )

    if (pi.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not yet confirmed", stripeStatus: pi.status },
        { status: 400 }
      )
    }

    // Confirm the booking
    await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        payment_status: "paid",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", id)

    await supabase
      .from("payments")
      .update({
        status: "completed",
        stripe_charge_id: pi.latest_charge as string,
      })
      .eq("id", payment.id)

    // Generate access codes directly
    await generateAccessCodesForBooking(id, supabase)

    return NextResponse.json({ confirmed: true })
  } catch (error: any) {
    console.error("Confirm booking error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to confirm booking" },
      { status: 500 }
    )
  }
}

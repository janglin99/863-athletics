import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { Seam } from "seam"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

async function generateAccessCodes(bookingId: string) {
  if (!process.env.SEAM_API_KEY || !process.env.SEAM_IGLOOHOME_DEVICE_ID) return

  const supabaseAdmin = getSupabaseAdmin()
  const seam = new Seam({ apiKey: process.env.SEAM_API_KEY })
  const deviceId = process.env.SEAM_IGLOOHOME_DEVICE_ID

  const { data: booking } = await supabaseAdmin
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

      await supabaseAdmin.from("access_codes").insert({
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
      await supabaseAdmin.from("access_codes").insert({
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

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const supabaseAdmin = getSupabaseAdmin()
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json(
      { error: "Webhook signature failed" },
      { status: 400 }
    )
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent
    const bookingId = pi.metadata.booking_id

    await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        stripe_charge_id: pi.latest_charge as string,
      })
      .eq("stripe_payment_intent_id", pi.id)

    await supabaseAdmin
      .from("bookings")
      .update({
        status: "confirmed",
        payment_status: "paid",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", bookingId)

    // Generate access codes via Seam
    await generateAccessCodes(bookingId)
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent

    await supabaseAdmin
      .from("payments")
      .update({ status: "failed" })
      .eq("stripe_payment_intent_id", pi.id)
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge

    await supabaseAdmin
      .from("payments")
      .update({
        status: "refunded",
        stripe_refund_id: charge.refunds?.data?.[0]?.id,
      })
      .eq("stripe_charge_id", charge.id)
  }

  return NextResponse.json({ received: true })
}

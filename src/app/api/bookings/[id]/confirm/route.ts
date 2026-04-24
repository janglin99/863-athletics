import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"

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

    // Generate access codes
    if (process.env.SEAM_API_KEY && process.env.SEAM_IGLOOHOME_DEVICE_ID) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://863athletics.com"
        await fetch(`${baseUrl}/api/access-codes/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: id }),
        })
      } catch {
        // Best-effort
      }
    }

    return NextResponse.json({ confirmed: true })
  } catch (error: any) {
    console.error("Confirm booking error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to confirm booking" },
      { status: 500 }
    )
  }
}

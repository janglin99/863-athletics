import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { generateAccessCodes } from "@/lib/access-codes/generate"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
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
    // Support multi-booking PIs (booking_ids = comma-separated) and legacy
    // single-booking PIs (booking_id) for in-flight payments at deploy time.
    const bookingIds: string[] = pi.metadata.booking_ids
      ? pi.metadata.booking_ids.split(",").filter(Boolean)
      : pi.metadata.booking_id
        ? [pi.metadata.booking_id]
        : []

    await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        stripe_charge_id: pi.latest_charge as string,
      })
      .eq("stripe_payment_intent_id", pi.id)

    if (bookingIds.length > 0) {
      await supabaseAdmin
        .from("bookings")
        .update({
          status: "confirmed",
          payment_status: "paid",
          confirmed_at: new Date().toISOString(),
        })
        .in("id", bookingIds)

      // Generate access codes for each confirmed booking
      for (const id of bookingIds) {
        await generateAccessCodes(id)
      }
    }
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

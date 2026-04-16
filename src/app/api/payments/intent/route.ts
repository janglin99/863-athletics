import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { bookingId } = await req.json()

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, customer:profiles!customer_id(*)")
    .eq("id", bookingId)
    .eq("customer_id", user.id)
    .single()

  if (!booking)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })

  // Get or create Stripe customer
  let stripeCustomerId = booking.customer.stripe_customer_id

  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      email: booking.customer.email,
      name: `${booking.customer.first_name} ${booking.customer.last_name}`,
      phone: booking.customer.phone || undefined,
      metadata: { supabase_id: user.id },
    })
    stripeCustomerId = stripeCustomer.id

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", user.id)
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: booking.total_cents,
    currency: "usd",
    customer: stripeCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      booking_id: bookingId,
      booking_number: booking.booking_number,
      customer_id: user.id,
    },
    description: `863 Athletics — Booking ${booking.booking_number}`,
    receipt_email: booking.customer.email,
  })

  // Create payment record
  await supabase.from("payments").insert({
    booking_id: bookingId,
    customer_id: user.id,
    amount_cents: booking.total_cents,
    method: "stripe_card",
    status: "pending",
    stripe_payment_intent_id: paymentIntent.id,
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}

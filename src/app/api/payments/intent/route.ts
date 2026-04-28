import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    // Accept either { bookingId } (single) or { bookingIds: [] } (multi).
    const bookingIds: string[] = Array.isArray(body.bookingIds)
      ? body.bookingIds
      : body.bookingId
        ? [body.bookingId]
        : []

    if (bookingIds.length === 0) {
      return NextResponse.json(
        { error: "bookingId or bookingIds required" },
        { status: 400 }
      )
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("*, customer:profiles!customer_id(*)")
      .in("id", bookingIds)
      .eq("customer_id", user.id)

    if (bookingsError || !bookings || bookings.length !== bookingIds.length) {
      return NextResponse.json(
        { error: "One or more bookings not found" },
        { status: 404 }
      )
    }

    const customer = bookings[0].customer
    const totalCents = bookings.reduce(
      (sum, b) => sum + (b.total_cents ?? 0),
      0
    )

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    let stripeCustomerId = customer.stripe_customer_id
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name: `${customer.first_name} ${customer.last_name}`,
        phone: customer.phone || undefined,
        metadata: { supabase_id: user.id },
      })
      stripeCustomerId = stripeCustomer.id

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id)
    }

    const bookingNumbers = bookings.map((b) => b.booking_number).join(",")
    const description =
      bookings.length === 1
        ? `863 Athletics — Booking ${bookings[0].booking_number}`
        : `863 Athletics — ${bookings.length} bookings (${bookingNumbers})`

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        booking_ids: bookings.map((b) => b.id).join(","),
        booking_numbers: bookingNumbers,
        customer_id: user.id,
      },
      description,
      receipt_email: customer.email,
    })

    // One payment row per booking, all linked to the same Stripe PI.
    const paymentRows = bookings.map((b) => ({
      booking_id: b.id,
      customer_id: user.id,
      amount_cents: b.total_cents,
      method: "stripe_card",
      status: "pending",
      stripe_payment_intent_id: paymentIntent.id,
    }))
    await supabase.from("payments").insert(paymentRows)

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
  } catch (error: unknown) {
    console.error("Payment intent error:", error)
    const message =
      error instanceof Error ? error.message : "Failed to create payment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

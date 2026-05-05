import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { getStripeServer } from "@/lib/stripe/server"
import { z } from "zod"

const bodySchema = z.object({
  action: z.enum(["refund", "credit"]),
})

// Resolves the gap between completed payments and the booking's current total
// — typically created when an admin retroactively applies a discount that
// reduces the total below what the customer already paid.
//
// Refund: issues a partial Stripe refund against the booking's latest
// completed Stripe payment and updates the payments row.
// Credit: grants a user_credits row in dollars for the overage so the
// customer can apply it to a future booking.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }
  const { action } = parsed.data

  // Fetch booking + payments authoritatively
  const { data: booking, error: bookingErr } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_id, booking_number, total_cents, payments(id, amount_cents, refunded_amount_cents, status, method, stripe_payment_intent_id, stripe_charge_id)"
    )
    .eq("id", id)
    .single()
  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  type PaymentLite = {
    id: string
    amount_cents: number
    refunded_amount_cents: number | null
    status: string
    method: string
    stripe_payment_intent_id: string | null
    stripe_charge_id: string | null
  }
  const payments = (booking.payments ?? []) as PaymentLite[]
  const completedPaid = payments
    .filter((p) => p.status === "completed" || p.status === "partially_refunded")
    .reduce(
      (sum, p) => sum + (p.amount_cents ?? 0) - (p.refunded_amount_cents ?? 0),
      0
    )
  const overpaymentCents = Math.max(0, completedPaid - (booking.total_cents ?? 0))
  if (overpaymentCents <= 0) {
    return NextResponse.json(
      { error: "No overpayment to resolve" },
      { status: 400 }
    )
  }

  if (action === "credit") {
    const amountDollars = +(overpaymentCents / 100).toFixed(2)
    const description = `Overpayment credit — booking #${booking.booking_number}`
    const { data: credit, error: creditErr } = await supabaseAdmin
      .from("user_credits")
      .insert({
        customer_id: booking.customer_id,
        credit_type: "dollar",
        original_amount: amountDollars,
        remaining_amount: amountDollars,
        description,
        granted_by: user.id,
      })
      .select()
      .single()
    if (creditErr) {
      return NextResponse.json({ error: creditErr.message }, { status: 500 })
    }
    await supabaseAdmin.from("credit_transactions").insert({
      credit_id: credit.id,
      booking_id: booking.id,
      amount: amountDollars,
      type: "grant",
      notes: description,
    })
    return NextResponse.json({
      action: "credit",
      amountCents: overpaymentCents,
      creditId: credit.id,
    })
  }

  // Refund path: find a completed Stripe payment with at least overpaymentCents
  // remaining to refund. Bail out if none exists (cash/zelle/cash_app
  // payments need to be refunded out-of-band).
  const refundable = payments.find(
    (p) =>
      (p.status === "completed" || p.status === "partially_refunded") &&
      (p.method?.startsWith("stripe") ?? false) &&
      p.stripe_payment_intent_id &&
      (p.amount_cents - (p.refunded_amount_cents ?? 0)) >= overpaymentCents
  )
  if (!refundable) {
    return NextResponse.json(
      {
        error:
          "No Stripe payment available to refund. Issue the refund out-of-band (cash/Zelle/etc) and grant a credit if needed.",
      },
      { status: 400 }
    )
  }

  let stripeRefundId: string | null = null
  try {
    const stripe = getStripeServer()
    const refund = await stripe.refunds.create({
      payment_intent: refundable.stripe_payment_intent_id!,
      amount: overpaymentCents,
    })
    stripeRefundId = refund.id
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe refund failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const newRefunded = (refundable.refunded_amount_cents ?? 0) + overpaymentCents
  const fullyRefunded = newRefunded >= refundable.amount_cents
  await supabaseAdmin
    .from("payments")
    .update({
      refunded_amount_cents: newRefunded,
      status: fullyRefunded ? "refunded" : "partially_refunded",
      stripe_refund_id: stripeRefundId,
    })
    .eq("id", refundable.id)

  await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: fullyRefunded ? "fully_refunded" : "partially_refunded",
    })
    .eq("id", booking.id)

  return NextResponse.json({
    action: "refund",
    amountCents: overpaymentCents,
    stripeRefundId,
  })
}

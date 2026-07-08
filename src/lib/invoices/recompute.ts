import type { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Recomputes an invoice's paid_cents/status from ground truth: real completed
 * payments against the bookings it covers, plus any payments recorded
 * directly against the invoice (for customers billed on account who don't
 * pay at time of booking). bookings.payment_status is NOT trusted here — it
 * gets set to 'paid' at booking time for account-billed bookings even though
 * no money has changed hands yet.
 */
export async function recomputeInvoicePaidCents(
  supabase: SupabaseServerClient,
  invoiceId: string
) {
  const { data: invoice } = await supabase
    .from("customer_invoices")
    .select("id, total_cents")
    .eq("id", invoiceId)
    .single()

  if (!invoice) return null

  const { data: items } = await supabase
    .from("customer_invoice_items")
    .select("booking_id")
    .eq("invoice_id", invoiceId)

  const bookingIds = (items ?? [])
    .map((i) => i.booking_id)
    .filter((id): id is string => !!id)

  let bookingsPaidCents = 0
  if (bookingIds.length > 0) {
    const { data: payments } = await supabase
      .from("payments")
      .select("amount_cents")
      .in("booking_id", bookingIds)
      .eq("status", "completed")
    bookingsPaidCents = (payments ?? []).reduce(
      (sum, p) => sum + p.amount_cents,
      0
    )
  }

  const { data: manualPayments } = await supabase
    .from("customer_invoice_payments")
    .select("amount_cents")
    .eq("invoice_id", invoiceId)
  const manualPaidCents = (manualPayments ?? []).reduce(
    (sum, p) => sum + p.amount_cents,
    0
  )

  const paidCents = bookingsPaidCents + manualPaidCents
  const status = paidCents >= invoice.total_cents ? "closed" : "open"

  await supabase
    .from("customer_invoices")
    .update({ paid_cents: paidCents, status })
    .eq("id", invoiceId)

  return { paidCents, status }
}

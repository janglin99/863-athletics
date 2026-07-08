import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { recomputeInvoicePaidCents } from "@/lib/invoices/recompute"
import {
  startOfDayEastern,
  endOfDayEastern,
  startOfWeekEastern,
  endOfWeekEastern,
  startOfMonthEastern,
  endOfMonthEastern,
  parseEasternDateOnly,
  parseEasternDateOnlyEnd,
} from "@/lib/utils/timezone"

const BOOKING_SELECT =
  "id, total_cents, participant_count, created_at, rate:rates(name), slots:booking_slots(start_time, end_time, status), payments(amount_cents, status)"

interface BookingRow {
  id: string
  total_cents: number
  participant_count: number
  created_at: string
  rate: { name: string } | { name: string }[] | null
  slots: { start_time: string; end_time: string; status: string }[] | null
  payments: { amount_cents: number; status: string }[] | null
}

function rateName(rate: BookingRow["rate"]): string {
  if (!rate) return "Session"
  if (Array.isArray(rate)) return rate[0]?.name ?? "Session"
  return rate.name
}

function earliestSlotStart(booking: BookingRow): string {
  const active = (booking.slots ?? []).filter((s) => s.status !== "cancelled")
  if (active.length === 0) return booking.created_at
  return active.reduce((earliest, s) =>
    new Date(s.start_time) < new Date(earliest.start_time) ? s : earliest
  ).start_time
}

// bookings.payment_status is not trustworthy — it's set to 'paid' at booking
// time for account-billed bookings (e.g. trainer_account) even though no
// money has changed hands. The real completed payments table is ground truth.
function realPaidCents(booking: BookingRow): number {
  return (booking.payments ?? [])
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount_cents, 0)
}

function lineItemStatus(booking: BookingRow): "paid" | "partial" | "unpaid" {
  const paid = realPaidCents(booking)
  if (paid <= 0) return "unpaid"
  if (paid >= booking.total_cents) return "paid"
  return "partial"
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const {
    customerId,
    periodType,
    referenceDate,
    bookingId,
    startDate,
    endDate,
    publish,
  } = await req.json()

  if (!customerId || !periodType) {
    return NextResponse.json(
      { error: "customerId and periodType are required" },
      { status: 400 }
    )
  }
  if (!["session", "day", "week", "month", "custom"].includes(periodType)) {
    return NextResponse.json({ error: "Invalid periodType" }, { status: 400 })
  }
  if (periodType === "custom") {
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required for custom invoices" },
        { status: 400 }
      )
    }
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: "startDate must be on or before endDate" },
        { status: 400 }
      )
    }
  }

  const { data: customer } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", customerId)
    .single()

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }

  let periodStart: Date
  let periodEnd: Date
  let bookings: BookingRow[] = []

  if (periodType === "session") {
    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId is required for session invoices" },
        { status: 400 }
      )
    }
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", bookingId)
      .eq("customer_id", customerId)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    bookings = [booking as unknown as BookingRow]
    const start = earliestSlotStart(bookings[0])
    periodStart = new Date(start)
    const activeSlots = (bookings[0].slots ?? []).filter(
      (s) => s.status !== "cancelled"
    )
    periodEnd =
      activeSlots.length > 0
        ? new Date(
            activeSlots.reduce((latest, s) =>
              new Date(s.end_time) > new Date(latest.end_time) ? s : latest
            ).end_time
          )
        : periodStart
  } else {
    if (periodType === "custom") {
      periodStart = parseEasternDateOnly(startDate)
      periodEnd = parseEasternDateOnlyEnd(endDate)
    } else {
      // referenceDate is a plain "YYYY-MM-DD" date-picker value — anchor it
      // to the facility's timezone before deriving day/week/month bounds,
      // otherwise the boundary lands on whatever timezone this process
      // happens to run in (UTC on Vercel), shifting everything back a day.
      const ref = referenceDate ? parseEasternDateOnly(referenceDate) : new Date()
      if (periodType === "day") {
        periodStart = startOfDayEastern(ref)
        periodEnd = endOfDayEastern(ref)
      } else if (periodType === "week") {
        periodStart = startOfWeekEastern(ref)
        periodEnd = endOfWeekEastern(ref)
      } else {
        periodStart = startOfMonthEastern(ref)
        periodEnd = endOfMonthEastern(ref)
      }
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("customer_id", customerId)
      .neq("status", "cancelled")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    bookings = ((data ?? []) as unknown as BookingRow[]).filter((b) => {
      const start = new Date(earliestSlotStart(b))
      return start >= periodStart && start <= periodEnd
    })
  }

  const lineItems = bookings.map((b) => ({
    booking_id: b.id,
    description:
      rateName(b.rate) + (b.participant_count > 1 ? ` (×${b.participant_count})` : ""),
    session_date: earliestSlotStart(b),
    payment_status: lineItemStatus(b),
    amount_cents: b.total_cents,
  }))

  const totalCents = lineItems.reduce((sum, i) => sum + i.amount_cents, 0)

  const periodStartIso = periodStart.toISOString()
  const periodEndIso = periodEnd.toISOString()

  const { data: existing } = await supabase
    .from("customer_invoices")
    .select("id")
    .eq("customer_id", customerId)
    .eq("period_type", periodType)
    .eq("period_start", periodStartIso)
    .eq("period_end", periodEndIso)
    .maybeSingle()

  let invoiceId: string

  if (existing) {
    invoiceId = existing.id
    const updates: Record<string, unknown> = {
      total_cents: totalCents,
      generated_by: user.id,
    }
    // Regenerating never un-publishes an invoice — only explicitly
    // requesting publish can move it from draft to published.
    if (publish) {
      const { data: existingInvoice } = await supabase
        .from("customer_invoices")
        .select("published_at")
        .eq("id", invoiceId)
        .single()
      if (!existingInvoice?.published_at) {
        updates.published_at = new Date().toISOString()
      }
    }
    const { error } = await supabase
      .from("customer_invoices")
      .update(updates)
      .eq("id", invoiceId)
    if (error) {
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      )
    }
    await supabase
      .from("customer_invoice_items")
      .delete()
      .eq("invoice_id", invoiceId)
  } else {
    const { data: newInvoice, error } = await supabase
      .from("customer_invoices")
      .insert({
        customer_id: customerId,
        period_type: periodType,
        period_start: periodStartIso,
        period_end: periodEndIso,
        total_cents: totalCents,
        generated_by: user.id,
        published_at: publish ? new Date().toISOString() : null,
      })
      .select("id")
      .single()
    if (error || !newInvoice) {
      return NextResponse.json(
        { error: error?.message || "Failed to create invoice" },
        { status: 500 }
      )
    }
    invoiceId = newInvoice.id
  }

  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("customer_invoice_items")
      .insert(lineItems.map((item) => ({ invoice_id: invoiceId, ...item })))
    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to create invoice items" },
        { status: 500 }
      )
    }
  }

  await recomputeInvoicePaidCents(supabase, invoiceId)

  const { data: invoice } = await supabase
    .from("customer_invoices")
    .select(
      "*, customer:profiles!customer_id(*), items:customer_invoice_items(*), payments:customer_invoice_payments(*)"
    )
    .eq("id", invoiceId)
    .single()

  return NextResponse.json(invoice)
}

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface SlotWithBooking {
  id: string
  booking_id: string
  start_time: string
  end_time: string
  status: string
  booking: {
    id: string
    customer_id: string
    payment_method: string | null
    status: string
  } | null
}

interface InvoiceSession {
  bookingId: string
  start: string
  end: string
  hours: number
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

  const { trainerId, month, year } = await req.json()

  if (!trainerId || !month || !year) {
    return NextResponse.json(
      { error: "trainerId, month, and year are required" },
      { status: 400 }
    )
  }

  const { data: trainer } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", trainerId)
    .single()

  if (!trainer) {
    return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
  }

  // Pull booking_slots whose start_time falls within the target month, joined
  // to the trainer's confirmed/completed self-bookings (payment_method =
  // trainer_account, customer_id = trainer). Filtering on the slot date is the
  // key: a booking created in March with sessions in April should bill
  // against April, and a recurring booking spanning multiple months should
  // split across each month's invoice.
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const endOfMonth = new Date(
    Date.UTC(year, month, 0, 23, 59, 59, 999)
  ).toISOString()

  const { data: slotRows, error: slotsErr } = await supabase
    .from("booking_slots")
    .select(
      "id, booking_id, start_time, end_time, status, booking:bookings!inner(id, customer_id, payment_method, status)"
    )
    .eq("booking.customer_id", trainerId)
    .eq("booking.payment_method", "trainer_account")
    .in("booking.status", ["confirmed", "completed"])
    .neq("status", "cancelled")
    .gte("start_time", startOfMonth)
    .lte("start_time", endOfMonth)
    .order("start_time", { ascending: true })

  if (slotsErr) {
    return NextResponse.json({ error: slotsErr.message }, { status: 500 })
  }

  // Merge consecutive slots within the same booking into sessions (matching
  // the access-code generator's algorithm). A 2-hour booking stored as 4 ×
  // 30-min slots becomes 1 session of 2 hours, not 4 line items of 0.5 hours.
  const slotsByBooking = new Map<string, SlotWithBooking[]>()
  for (const s of (slotRows ?? []) as unknown as SlotWithBooking[]) {
    const list = slotsByBooking.get(s.booking_id) ?? []
    list.push(s)
    slotsByBooking.set(s.booking_id, list)
  }

  const sessions: InvoiceSession[] = []
  for (const [bookingId, list] of slotsByBooking) {
    list.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )
    let cur = {
      start: list[0].start_time,
      end: list[0].end_time,
    }
    for (let i = 1; i < list.length; i++) {
      const s = list[i]
      if (new Date(s.start_time).getTime() === new Date(cur.end).getTime()) {
        cur.end = s.end_time
      } else {
        const hours =
          (new Date(cur.end).getTime() - new Date(cur.start).getTime()) /
          3_600_000
        sessions.push({ bookingId, ...cur, hours })
        cur = { start: s.start_time, end: s.end_time }
      }
    }
    const tailHours =
      (new Date(cur.end).getTime() - new Date(cur.start).getTime()) /
      3_600_000
    sessions.push({ bookingId, ...cur, hours: tailHours })
  }

  // Build line items from sessions, applying commission rules.
  const lineItems = sessions.map((s) => {
    let rateCents = 0
    let amountCents = 0
    if (trainer.commission_type === "hourly") {
      rateCents = (trainer.commission_rate || 0) * 100
      amountCents = Math.round(rateCents * s.hours)
    } else if (trainer.commission_type === "flat_per_session") {
      rateCents = (trainer.commission_rate || 0) * 100
      amountCents = rateCents
    }
    // flat_monthly and percentage leave per-line zero — totals filled below.
    return {
      booking_id: s.bookingId,
      session_date: s.start,
      start_time: s.start,
      end_time: s.end,
      hours: Math.round(s.hours * 100) / 100,
      rate_cents: rateCents,
      amount_cents: amountCents,
    }
  })

  const totalSessions = sessions.length
  const totalHours = Math.round(
    sessions.reduce((sum, s) => sum + s.hours, 0) * 100
  ) / 100

  let totalAmountCents = 0
  if (trainer.commission_type === "hourly") {
    totalAmountCents = lineItems.reduce((s, i) => s + i.amount_cents, 0)
  } else if (trainer.commission_type === "flat_per_session") {
    totalAmountCents = (trainer.commission_rate || 0) * 100 * totalSessions
  } else if (trainer.commission_type === "flat_monthly") {
    totalAmountCents = (trainer.commission_rate || 0) * 100
  }
  // percentage stays 0 — admin sets manually.

  // Upsert the invoice row + replace line items.
  const { data: existing } = await supabase
    .from("trainer_invoices")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle()

  let invoiceId: string

  if (existing) {
    invoiceId = existing.id
    const { error } = await supabase
      .from("trainer_invoices")
      .update({
        total_sessions: totalSessions,
        total_hours: totalHours,
        total_amount_cents: totalAmountCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
    if (error) {
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      )
    }
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)
  } else {
    const { data: newInvoice, error } = await supabase
      .from("trainer_invoices")
      .insert({
        trainer_id: trainerId,
        month,
        year,
        total_sessions: totalSessions,
        total_hours: totalHours,
        total_amount_cents: totalAmountCents,
        status: "pending",
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
    const itemsToInsert = lineItems.map((item) => ({
      invoice_id: invoiceId,
      ...item,
    }))
    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemsToInsert)
    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to create invoice items" },
        { status: 500 }
      )
    }
  }

  const { data: invoice } = await supabase
    .from("trainer_invoices")
    .select("*, trainer:profiles!trainer_id(*), items:invoice_items(*)")
    .eq("id", invoiceId)
    .single()

  return NextResponse.json(invoice)
}

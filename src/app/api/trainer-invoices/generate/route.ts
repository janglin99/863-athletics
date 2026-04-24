import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

  // Get trainer profile
  const { data: trainer } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", trainerId)
    .single()

  if (!trainer) {
    return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
  }

  // Find confirmed bookings for this trainer in the given month/year
  const startOfMonth = new Date(year, month - 1, 1).toISOString()
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, slots:booking_slots(*)")
    .eq("customer_id", trainerId)
    .eq("payment_method", "trainer_account")
    .eq("status", "confirmed")
    .gte("created_at", startOfMonth)
    .lte("created_at", endOfMonth)

  const bookingList = bookings || []
  const totalSessions = bookingList.length

  // Calculate total hours and build line items
  let totalHours = 0
  const lineItems: Array<{
    booking_id: string
    session_date: string
    start_time: string
    end_time: string
    hours: number
    rate_cents: number
    amount_cents: number
  }> = []

  for (const booking of bookingList) {
    const slots = booking.slots || []
    for (const slot of slots) {
      const start = new Date(slot.start_time)
      const end = new Date(slot.end_time)
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      totalHours += hours

      let rateCents = 0
      let amountCents = 0

      if (trainer.commission_type === "hourly") {
        rateCents = (trainer.commission_rate || 0) * 100
        amountCents = Math.round(rateCents * hours)
      } else if (trainer.commission_type === "flat_per_session") {
        rateCents = (trainer.commission_rate || 0) * 100
        amountCents = rateCents
      } else if (trainer.commission_type === "flat_monthly") {
        rateCents = 0
        amountCents = 0
      } else {
        // percentage — mark as manual
        rateCents = 0
        amountCents = 0
      }

      lineItems.push({
        booking_id: booking.id,
        session_date: slot.start_time,
        start_time: slot.start_time,
        end_time: slot.end_time,
        hours: Math.round(hours * 100) / 100,
        rate_cents: rateCents,
        amount_cents: amountCents,
      })
    }
  }

  // Calculate total amount
  let totalAmountCents = 0
  if (trainer.commission_type === "hourly") {
    totalAmountCents = lineItems.reduce((sum, item) => sum + item.amount_cents, 0)
  } else if (trainer.commission_type === "flat_per_session") {
    totalAmountCents = (trainer.commission_rate || 0) * 100 * totalSessions
  } else if (trainer.commission_type === "flat_monthly") {
    totalAmountCents = (trainer.commission_rate || 0) * 100
  }
  // percentage stays 0

  // Upsert the invoice
  const { data: existingInvoice } = await supabase
    .from("trainer_invoices")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("month", month)
    .eq("year", year)
    .single()

  let invoiceId: string

  if (existingInvoice) {
    invoiceId = existingInvoice.id
    const { error } = await supabase
      .from("trainer_invoices")
      .update({
        total_sessions: totalSessions,
        total_hours: Math.round(totalHours * 100) / 100,
        total_amount_cents: totalAmountCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)

    if (error) {
      return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 })
    }

    // Delete existing line items before re-creating
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)
  } else {
    const { data: newInvoice, error } = await supabase
      .from("trainer_invoices")
      .insert({
        trainer_id: trainerId,
        month,
        year,
        total_sessions: totalSessions,
        total_hours: Math.round(totalHours * 100) / 100,
        total_amount_cents: totalAmountCents,
        status: "pending",
      })
      .select("id")
      .single()

    if (error || !newInvoice) {
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
    }

    invoiceId = newInvoice.id
  }

  // Insert line items
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

  // Fetch the final invoice with items
  const { data: invoice } = await supabase
    .from("trainer_invoices")
    .select("*, trainer:profiles!trainer_id(*), items:invoice_items(*)")
    .eq("id", invoiceId)
    .single()

  return NextResponse.json(invoice)
}

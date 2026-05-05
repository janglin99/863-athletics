import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { validatePromoCode } from "@/lib/promo-codes/validate"
import { z } from "zod"

const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "refunded",
] as const

const PAYMENT_STATUSES = [
  "unpaid",
  "pending_manual",
  "paid",
  "partially_refunded",
  "fully_refunded",
] as const

const slotPatchSchema = z.object({
  id: z.string().uuid(),
  start: z.string().datetime(),
  end: z.string().datetime(),
})

const patchSchema = z
  .object({
    notes: z.string().max(500).nullable().optional(),
    internalNotes: z.string().max(2000).nullable().optional(),
    totalCents: z.number().int().min(0).max(10_000_00).optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    slots: z.array(slotPatchSchema).max(50).optional(),
    // When provided, server re-validates and applies the promo authoritatively
    // (computes new subtotal/discount/total, increments usage_count). Wins
    // over a manually-passed totalCents.
    promoCode: z.string().trim().min(1).max(64).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field to update",
  })

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" as const, status: 401, supabase, user: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return { error: "Forbidden" as const, status: 403, supabase, user }
  }
  return { error: null, status: 200, supabase, user }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireSuperAdmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }
  const data = parsed.data

  const update: Record<string, unknown> = {}
  if (data.notes !== undefined) update.notes = data.notes
  if (data.internalNotes !== undefined) update.internal_notes = data.internalNotes
  if (data.totalCents !== undefined) {
    update.total_cents = data.totalCents
    update.subtotal_cents = data.totalCents
  }
  if (data.status !== undefined) update.status = data.status
  if (data.paymentStatus !== undefined) update.payment_status = data.paymentStatus

  // Promo retro-application: server re-validates and overrides totals so the
  // admin doesn't have to compute the discount themselves.
  let promoToRedeem: { id: string; usage_count: number } | null = null
  if (data.promoCode) {
    const { data: bookingRow } = await auth.supabase
      .from("bookings")
      .select(
        "participant_count, internal_notes, rate:rates(type, price_cents, per_unit), slots:booking_slots(start_time, end_time, status)"
      )
      .eq("id", id)
      .single()

    type RateLite = {
      type: string
      price_cents: number
      per_unit: "session" | "hour" | "month" | "person"
    }
    type SlotLite = {
      start_time: string
      end_time: string
      status: string
    }
    const rate = (
      Array.isArray(bookingRow?.rate) ? bookingRow?.rate[0] : bookingRow?.rate
    ) as RateLite | null
    const slots = ((bookingRow?.slots ?? []) as SlotLite[]).filter(
      (s) => s.status !== "cancelled"
    )

    if (!bookingRow || !rate) {
      return NextResponse.json(
        { error: "Booking or rate not found" },
        { status: 404 }
      )
    }

    const totalMs = slots.reduce(
      (ms, s) =>
        ms + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()),
      0
    )
    const totalHours = totalMs / (1000 * 60 * 60)
    let grossSubtotal = rate.price_cents
    if (rate.per_unit === "hour") {
      grossSubtotal = Math.round(rate.price_cents * totalHours)
    } else if (rate.per_unit === "person") {
      grossSubtotal = Math.round(
        rate.price_cents *
          (bookingRow.participant_count ?? 1) *
          totalHours
      )
    }

    const result = await validatePromoCode(auth.supabase, {
      code: data.promoCode,
      rateType: rate.type,
      subtotalCents: grossSubtotal,
      hours: totalHours,
    })
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const discountCents = result.discount.amountOff
    const newTotal = Math.max(0, grossSubtotal - discountCents)
    update.subtotal_cents = grossSubtotal
    update.discount_cents = discountCents
    update.total_cents = newTotal

    // Append a trail note unless the admin is also setting internal_notes
    // explicitly in this patch.
    if (data.internalNotes === undefined) {
      const codeLabel = data.promoCode.toUpperCase()
      const trail = `Promo ${codeLabel} applied retroactively (-$${(
        discountCents / 100
      ).toFixed(2)})`
      const existing = (bookingRow.internal_notes ?? "").toString().trim()
      update.internal_notes = existing ? `${existing} | ${trail}` : trail
    }

    promoToRedeem = {
      id: result.promo.id,
      usage_count: result.promo.usage_count,
    }
  }

  if (Object.keys(update).length > 0) {
    const { error: bookingErr } = await auth.supabase
      .from("bookings")
      .update(update)
      .eq("id", id)
    if (bookingErr) {
      return NextResponse.json({ error: bookingErr.message }, { status: 500 })
    }
  }

  if (promoToRedeem) {
    await auth.supabase
      .from("promo_codes")
      .update({ usage_count: promoToRedeem.usage_count + 1 })
      .eq("id", promoToRedeem.id)
  }

  if (data.slots && data.slots.length > 0) {
    for (const slot of data.slots) {
      const { error: slotErr } = await auth.supabase
        .from("booking_slots")
        .update({ start_time: slot.start, end_time: slot.end })
        .eq("id", slot.id)
        .eq("booking_id", id)
      if (slotErr) {
        return NextResponse.json(
          { error: `Failed to update slot ${slot.id}: ${slotErr.message}` },
          { status: 500 }
        )
      }
    }
  }

  const { data: updated, error: reloadErr } = await auth.supabase
    .from("bookings")
    .select(
      "*, customer:profiles!customer_id(*), rate:rates(*), slots:booking_slots(*), payments(*), access_codes(*)"
    )
    .eq("id", id)
    .single()

  if (reloadErr || !updated) {
    return NextResponse.json(
      { error: reloadErr?.message || "Booking not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({ booking: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireSuperAdmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Refuse delete if this booking is locked into a trainer invoice — those are
  // billing records and shouldn't disappear from history.
  const { data: invoiceLines } = await supabaseAdmin
    .from("invoice_items")
    .select("id")
    .eq("booking_id", id)
    .limit(1)

  if (invoiceLines && invoiceLines.length > 0) {
    return NextResponse.json(
      {
        error:
          "This booking is included in a trainer invoice and cannot be deleted. Cancel it instead, or remove the invoice line first.",
      },
      { status: 409 }
    )
  }

  // Cascade cleanup. RLS on these tables doesn't grant DELETE to admins, so we
  // use the service-role client. Order matters only for FK integrity.
  // (cart_items intentionally excluded — it's a pre-booking shopping cart
  // keyed by rate/customer, with no booking_id reference.)
  const cascadeTables = [
    "payments",
    "access_codes",
    "notification_log",
    "reviews",
    "credit_transactions",
  ] as const

  for (const table of cascadeTables) {
    const { error } = await supabaseAdmin.from(table).delete().eq("booking_id", id)
    if (error) {
      return NextResponse.json(
        { error: `Failed to clear ${table}: ${error.message}` },
        { status: 500 }
      )
    }
  }

  // Null out self-references from sibling bookings before deleting this row.
  await supabaseAdmin
    .from("bookings")
    .update({ recurring_parent_id: null })
    .eq("recurring_parent_id", id)
  await supabaseAdmin
    .from("bookings")
    .update({ rescheduled_from: null })
    .eq("rescheduled_from", id)

  // booking_slots cascades automatically (ON DELETE CASCADE).
  const { error: deleteErr } = await supabaseAdmin
    .from("bookings")
    .delete()
    .eq("id", id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ message: "Booking deleted" })
}

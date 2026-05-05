import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validatePromoCode } from "@/lib/promo-codes/validate"
import { z } from "zod"

const bodySchema = z.object({
  bookingIds: z.array(z.string().uuid()).min(1).max(100),
  promoCode: z.string().trim().min(1).max(64),
})

interface AppliedRow {
  id: string
  booking_number: string
  discountCents: number
  overpaymentCents: number
}

interface SkippedRow {
  id: string
  booking_number: string
  reason: string
}

type RateLite = {
  type: string
  price_cents: number
  per_unit: "session" | "hour" | "month" | "person"
}
type SlotLite = { start_time: string; end_time: string; status: string }
type PaymentLite = {
  amount_cents: number
  refunded_amount_cents: number | null
  status: string
}

export async function POST(req: NextRequest) {
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
  const { bookingIds, promoCode } = parsed.data

  const { data: bookings, error: fetchErr } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, total_cents, discount_cents, internal_notes, participant_count, rate:rates(type, price_cents, per_unit), slots:booking_slots(start_time, end_time, status), payments(amount_cents, refunded_amount_cents, status)"
    )
    .in("id", bookingIds)

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ error: "No bookings found" }, { status: 404 })
  }

  const applied: AppliedRow[] = []
  const skipped: SkippedRow[] = []
  let promoId: string | null = null
  let promoUsageCount = 0
  const codeLabel = promoCode.toUpperCase()

  for (const b of bookings) {
    const bookingNumber = (b as { booking_number: string }).booking_number
    if ((b.discount_cents ?? 0) > 0) {
      skipped.push({
        id: b.id,
        booking_number: bookingNumber,
        reason: "Already has a discount applied",
      })
      continue
    }

    const rate = (Array.isArray(b.rate) ? b.rate[0] : b.rate) as
      | RateLite
      | null
    if (!rate) {
      skipped.push({
        id: b.id,
        booking_number: bookingNumber,
        reason: "No rate on booking",
      })
      continue
    }

    const slots = ((b.slots ?? []) as SlotLite[]).filter(
      (s) => s.status !== "cancelled"
    )
    const totalMs = slots.reduce(
      (ms, s) =>
        ms +
        (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()),
      0
    )
    const totalHours = totalMs / (1000 * 60 * 60)

    let grossSubtotal = rate.price_cents
    if (rate.per_unit === "hour") {
      grossSubtotal = Math.round(rate.price_cents * totalHours)
    } else if (rate.per_unit === "person") {
      grossSubtotal = Math.round(
        rate.price_cents * (b.participant_count ?? 1) * totalHours
      )
    }

    const result = await validatePromoCode(supabase, {
      code: promoCode,
      rateType: rate.type,
      subtotalCents: grossSubtotal,
      hours: totalHours,
    })
    if (!result.valid) {
      skipped.push({
        id: b.id,
        booking_number: bookingNumber,
        reason: result.error,
      })
      continue
    }
    // Capture the promo for the single end-of-batch increment.
    promoId = result.promo.id
    promoUsageCount = result.promo.usage_count

    const discountCents = result.discount.amountOff
    const newTotal = Math.max(0, grossSubtotal - discountCents)

    const completedPaid = ((b.payments ?? []) as PaymentLite[])
      .filter(
        (p) =>
          p.status === "completed" || p.status === "partially_refunded"
      )
      .reduce(
        (sum, p) =>
          sum + (p.amount_cents ?? 0) - (p.refunded_amount_cents ?? 0),
        0
      )
    const overpaymentCents = Math.max(0, completedPaid - newTotal)

    const trail = `Promo ${codeLabel} applied via bulk action (-$${(discountCents / 100).toFixed(2)})`
    const existing = (b.internal_notes ?? "").toString().trim()
    const newInternalNotes = existing ? `${existing} | ${trail}` : trail

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({
        subtotal_cents: grossSubtotal,
        discount_cents: discountCents,
        total_cents: newTotal,
        internal_notes: newInternalNotes,
      })
      .eq("id", b.id)

    if (updateErr) {
      skipped.push({
        id: b.id,
        booking_number: bookingNumber,
        reason: updateErr.message,
      })
      continue
    }

    applied.push({
      id: b.id,
      booking_number: bookingNumber,
      discountCents,
      overpaymentCents,
    })
  }

  // Single usage_count increment for the batch.
  if (promoId && applied.length > 0) {
    await supabase
      .from("promo_codes")
      .update({ usage_count: promoUsageCount + 1 })
      .eq("id", promoId)
  }

  const totalDiscountCents = applied.reduce((s, a) => s + a.discountCents, 0)
  const totalOverpaymentCents = applied.reduce(
    (s, a) => s + a.overpaymentCents,
    0
  )

  return NextResponse.json({
    applied,
    skipped,
    totalDiscountCents,
    totalOverpaymentCents,
    promoUsageIncremented: applied.length > 0,
  })
}

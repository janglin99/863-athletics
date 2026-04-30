import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { generateAccessCodes } from "@/lib/access-codes/generate"
import { validatePromoCode } from "@/lib/promo-codes/validate"

const createBookingSchema = z.object({
  rateId: z.string().uuid(),
  trainerId: z.string().uuid().optional(),
  slots: z
    .array(
      z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      })
    )
    .min(1)
    .max(200),
  participantCount: z.number().min(1).max(30).default(1),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum([
    "stripe_card",
    "stripe_apple_pay",
    "stripe_google_pay",
    "zelle",
    "cash_app",
    "cash",
    "trainer_account",
  ]),
  isRecurring: z.boolean().default(false),
  recurringPattern: z
    .object({
      frequency: z.enum(["weekly", "biweekly"]),
      daysOfWeek: z.array(z.number()),
      endDate: z.string().datetime(),
    })
    .optional(),
  waiverConfirmed: z.boolean(),
  promoCode: z.string().trim().min(1).max(64).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const data = parsed.data

  const { data: rate } = await supabase
    .from("rates")
    .select("*")
    .eq("id", data.rateId)
    .single()

  if (!rate)
    return NextResponse.json({ error: "Rate not found" }, { status: 404 })

  if (!data.waiverConfirmed) {
    return NextResponse.json(
      { error: "Waiver must be confirmed" },
      { status: 400 }
    )
  }

  const advanceNoticeHours = rate.advance_notice_hours ?? 0
  const cutoff = new Date(Date.now() + advanceNoticeHours * 3600000)
  const tooSoon = data.slots.some((s) => new Date(s.start) < cutoff)
  if (tooSoon) {
    const message =
      advanceNoticeHours <= 0
        ? "Selected time has already passed"
        : `${rate.name} requires ${advanceNoticeHours}h advance notice — pick a later time`
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Calculate total hours from slot durations
  const totalMs = data.slots.reduce((ms, slot) => {
    return ms + (new Date(slot.end).getTime() - new Date(slot.start).getTime())
  }, 0)
  const totalHours = totalMs / (1000 * 60 * 60)
  let subtotalCents = rate.price_cents

  if (rate.per_unit === "hour") {
    subtotalCents = Math.round(rate.price_cents * totalHours)
  } else if (rate.per_unit === "person") {
    subtotalCents = Math.round(rate.price_cents * data.participantCount * totalHours)
  }

  // Re-validate the promo code server-side and apply the discount before
  // inserting the booking, so totals are authoritative regardless of what the
  // client sent.
  let discountCents = 0
  let promoToRedeem: { id: string; usage_count: number } | null = null
  if (data.promoCode) {
    const promoResult = await validatePromoCode(supabase, {
      code: data.promoCode,
      rateType: rate.type,
      subtotalCents,
      hours: totalHours,
    })
    if (!promoResult.valid) {
      return NextResponse.json({ error: promoResult.error }, { status: 400 })
    }
    discountCents = promoResult.discount.amountOff
    promoToRedeem = {
      id: promoResult.promo.id,
      usage_count: promoResult.promo.usage_count,
    }
  }
  const totalCents = Math.max(0, subtotalCents - discountCents)

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      customer_id: user.id,
      trainer_id: data.trainerId || null,
      rate_id: data.rateId,
      status: "pending_payment",
      payment_status: "unpaid",
      payment_method: data.paymentMethod,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      total_cents: totalCents,
      participant_count: data.participantCount,
      notes: data.notes,
      is_recurring: data.isRecurring,
      recurring_pattern: data.recurringPattern || null,
      waiver_confirmed: data.waiverConfirmed,
    })
    .select()
    .single()

  if (bookingError) {
    return NextResponse.json(
      { error: bookingError.message },
      { status: 500 }
    )
  }

  const slotsData = data.slots.map((slot) => ({
    booking_id: booking.id,
    start_time: slot.start,
    end_time: slot.end,
    status: "scheduled",
  }))

  const { error: slotsError } = await supabase
    .from("booking_slots")
    .insert(slotsData)

  if (slotsError) {
    await supabase.from("bookings").delete().eq("id", booking.id)
    return NextResponse.json(
      { error: "Failed to create time slots — they may be taken" },
      { status: 409 }
    )
  }

  // Best-effort promo redemption. Racy under high concurrency, but acceptable
  // for our usage volume — usage_limit is a soft cap.
  if (promoToRedeem) {
    await supabase
      .from("promo_codes")
      .update({ usage_count: promoToRedeem.usage_count + 1 })
      .eq("id", promoToRedeem.id)
  }

  if (["zelle", "cash_app", "cash"].includes(data.paymentMethod)) {
    await supabase
      .from("bookings")
      .update({ payment_status: "pending_manual" })
      .eq("id", booking.id)
  }

  // In-house trainers skip payment — auto-confirm booking
  if (data.paymentMethod === "trainer_account") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, trainer_type")
      .eq("id", user.id)
      .single()

    if (profile?.role === "trainer" && profile?.trainer_type === "in_house") {
      await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          payment_status: "paid",
          payment_method: "trainer_account",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", booking.id)

      // Schedule access-code generation to run after the response is sent.
      // Avoids the previous round-trip to /api/access-codes/generate which
      // failed authentication (no cookies on the internal fetch) and could
      // push the request past Vercel's function timeout on mobile.
      after(() => generateAccessCodes(booking.id))
    }
  }

  return NextResponse.json(
    { booking: { ...booking, slots: slotsData }, message: "Booking created" },
    { status: 201 }
  )
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("bookings")
    .select("*, rate:rates(*), slots:booking_slots(*)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ bookings: data })
}

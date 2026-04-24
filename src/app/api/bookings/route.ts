import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

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
    .max(10),
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

  // Calculate total hours from slot durations
  const totalMs = data.slots.reduce((ms, slot) => {
    return ms + (new Date(slot.end).getTime() - new Date(slot.start).getTime())
  }, 0)
  const totalHours = totalMs / (1000 * 60 * 60)
  let totalCents = rate.price_cents

  if (rate.per_unit === "hour") {
    totalCents = Math.round(rate.price_cents * totalHours)
  } else if (rate.per_unit === "person") {
    totalCents = Math.round(rate.price_cents * data.participantCount * totalHours)
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      customer_id: user.id,
      trainer_id: data.trainerId || null,
      rate_id: data.rateId,
      status: "pending_payment",
      payment_status: "unpaid",
      payment_method: data.paymentMethod,
      subtotal_cents: totalCents,
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

      // Generate access codes for trainer bookings
      if (process.env.SEAM_API_KEY && process.env.SEAM_IGLOOHOME_DEVICE_ID) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://863athletics.com"
          await fetch(`${baseUrl}/api/access-codes/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: booking.id }),
          })
        } catch {
          // Best-effort — admin can generate manually
        }
      }
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

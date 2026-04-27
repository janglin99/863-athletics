import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { newSlots } = await req.json()

  if (!newSlots || !Array.isArray(newSlots) || newSlots.length === 0) {
    return NextResponse.json(
      { error: "New time slots are required" },
      { status: 400 }
    )
  }

  // Fetch booking with slots and rate (for advance notice)
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*, rate:rates(name, advance_notice_hours), slots:booking_slots(*)")
    .eq("id", id)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Verify user owns the booking
  if (booking.customer_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // Verify booking is confirmed
  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Only confirmed bookings can be rescheduled" },
      { status: 400 }
    )
  }

  // Calculate reschedule fee
  const activeSlots = (booking.slots || []).filter(
    (s: { status: string }) => s.status !== "cancelled"
  )

  if (activeSlots.length === 0) {
    return NextResponse.json(
      { error: "No active slots found" },
      { status: 400 }
    )
  }

  const earliestStart = activeSlots
    .map((s: { start_time: string }) => new Date(s.start_time).getTime())
    .sort((a: number, b: number) => a - b)[0]

  const hoursRemaining = (earliestStart - Date.now()) / (1000 * 60 * 60)

  if (hoursRemaining < 0) {
    return NextResponse.json(
      { error: "Cannot reschedule a past booking" },
      { status: 400 }
    )
  }

  // Fetch reschedule fee tiers
  const { data: tiers } = await supabase
    .from("reschedule_fees")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  let feeCents = 0
  let feeName = "No fee"

  if (tiers && tiers.length > 0) {
    let matchedTier = null
    for (const tier of tiers) {
      const minMatch = hoursRemaining >= tier.min_hours_before
      const maxMatch =
        tier.max_hours_before === null || hoursRemaining < tier.max_hours_before
      if (minMatch && maxMatch) {
        matchedTier = tier
        break
      }
    }
    if (!matchedTier) {
      matchedTier = tiers[tiers.length - 1]
    }
    feeCents = matchedTier.fee_cents
    feeName = matchedTier.name
  }

  // Verify new slots respect the rate's advance-notice window
  const advanceNoticeHours = booking.rate?.advance_notice_hours ?? 0
  const cutoff = new Date(Date.now() + advanceNoticeHours * 3600000)
  for (const slot of newSlots) {
    if (new Date(slot.start) < cutoff) {
      const message =
        advanceNoticeHours <= 0
          ? "New time slots must be in the future"
          : `${booking.rate?.name ?? "This rate"} requires ${advanceNoticeHours}h advance notice — pick a later time`
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  // Check availability for new slots
  const earliest = newSlots
    .map((s: { start: string }) => s.start)
    .sort()[0]
  const latest = newSlots
    .map((s: { end: string }) => s.end)
    .sort()
    .reverse()[0]

  const { data: existingBookedSlots } = await supabase.rpc("get_booked_slots", {
    check_start: earliest,
    check_end: latest,
  })

  // Filter out our own booking's slots when checking availability
  const conflicting = existingBookedSlots?.filter(
    (booked: { booking_id?: string; start_time: string; end_time: string }) => {
      if (booked.booking_id === id) return false
      return newSlots.some(
        (ns: { start: string; end: string }) =>
          new Date(booked.start_time) < new Date(ns.end) &&
          new Date(booked.end_time) > new Date(ns.start)
      )
    }
  )

  if (conflicting && conflicting.length > 0) {
    return NextResponse.json(
      { error: "Selected time slots are no longer available" },
      { status: 409 }
    )
  }

  // Cancel old slots
  await supabase
    .from("booking_slots")
    .update({ status: "cancelled" })
    .eq("booking_id", id)
    .neq("status", "cancelled")

  // Insert new slots
  const newSlotRows = newSlots.map((slot: { start: string; end: string }) => ({
    booking_id: id,
    start_time: slot.start,
    end_time: slot.end,
    status: "scheduled",
  }))

  const { error: insertError } = await supabase
    .from("booking_slots")
    .insert(newSlotRows)

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to create new slots: " + insertError.message },
      { status: 500 }
    )
  }

  // Update booking with reschedule info
  await supabase
    .from("bookings")
    .update({
      rescheduled_at: new Date().toISOString(),
      reschedule_fee_cents: feeCents,
    })
    .eq("id", id)

  return NextResponse.json({
    success: true,
    feeName,
    feeCents,
    message:
      feeCents > 0
        ? `Booking rescheduled. A ${feeName} fee of $${(feeCents / 100).toFixed(2)} has been applied.`
        : "Booking rescheduled successfully.",
  })
}

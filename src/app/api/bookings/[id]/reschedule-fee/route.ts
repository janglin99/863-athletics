import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
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

  // Fetch booking with slots
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*, slots:booking_slots(*)")
    .eq("id", id)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "Only confirmed bookings can be rescheduled", canReschedule: false },
      { status: 400 }
    )
  }

  // Find the earliest slot start_time
  const activeSlots = (booking.slots || []).filter(
    (s: { status: string }) => s.status !== "cancelled"
  )

  if (activeSlots.length === 0) {
    return NextResponse.json(
      { error: "No active slots found", canReschedule: false },
      { status: 400 }
    )
  }

  const earliestStart = activeSlots
    .map((s: { start_time: string }) => new Date(s.start_time).getTime())
    .sort((a: number, b: number) => a - b)[0]

  const hoursRemaining =
    (earliestStart - Date.now()) / (1000 * 60 * 60)

  // Fetch reschedule fee tiers
  const { data: tiers } = await supabase
    .from("reschedule_fees")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (!tiers || tiers.length === 0) {
    return NextResponse.json({
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      fee: { name: "No fee", fee_cents: 0 },
      canReschedule: true,
    })
  }

  // Find the matching tier
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

  // If no tier matched and hours are negative (past booking), can't reschedule
  if (hoursRemaining < 0) {
    return NextResponse.json({
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      fee: null,
      canReschedule: false,
      message: "This booking has already passed",
    })
  }

  // If no tier matched, use the lowest tier
  if (!matchedTier) {
    matchedTier = tiers[tiers.length - 1]
  }

  return NextResponse.json({
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    fee: {
      name: matchedTier.name,
      fee_cents: matchedTier.fee_cents,
    },
    canReschedule: true,
  })
}

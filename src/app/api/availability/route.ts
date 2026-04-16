import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addDays, format } from "date-fns"

const SLOT_DURATION_MINUTES = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get("start") || new Date().toISOString()
  const endDate =
    searchParams.get("end") || addDays(new Date(), 30).toISOString()

  const supabase = await createClient()

  const [{ data: facilityHours }, { data: blocks }, { data: bookedSlots }] =
    await Promise.all([
      supabase.from("facility_hours").select("*").order("day_of_week"),
      supabase
        .from("availability_blocks")
        .select("*")
        .lte("start_time", endDate)
        .gte("end_time", startDate),
      supabase.rpc("get_booked_slots", {
        check_start: startDate,
        check_end: endDate,
      }),
    ])

  const availabilityMap: Record<
    string,
    {
      date: string
      slots: Array<{ start: string; end: string; available: boolean }>
    }
  > = {}

  const start = new Date(startDate)
  const end = new Date(endDate)

  let current = new Date(start)
  while (current <= end) {
    const dateKey = format(current, "yyyy-MM-dd")
    const dayOfWeek = current.getDay()
    const dayHours = facilityHours?.find((h) => h.day_of_week === dayOfWeek)

    if (!dayHours?.is_open) {
      availabilityMap[dateKey] = { date: dateKey, slots: [] }
      current = addDays(current, 1)
      continue
    }

    const [openH, openM] = dayHours.open_time.split(":").map(Number)
    const [closeH, closeM] = dayHours.close_time.split(":").map(Number)

    const dayOpen = new Date(current)
    dayOpen.setHours(openH, openM, 0, 0)

    const dayClose = new Date(current)
    dayClose.setHours(closeH, closeM, 0, 0)

    const slots = []
    let slotStart = new Date(dayOpen)

    while (slotStart < dayClose) {
      const slotEnd = new Date(
        slotStart.getTime() + SLOT_DURATION_MINUTES * 60000
      )

      const isBlocked = blocks?.some(
        (block) =>
          new Date(block.start_time) < slotEnd &&
          new Date(block.end_time) > slotStart
      )

      const isBooked = bookedSlots?.some(
        (booked: { start_time: string; end_time: string }) =>
          new Date(booked.start_time) < slotEnd &&
          new Date(booked.end_time) > slotStart
      )

      const isPast = slotStart < new Date()

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available: !isBlocked && !isBooked && !isPast,
      })

      slotStart = slotEnd
    }

    availabilityMap[dateKey] = { date: dateKey, slots }
    current = addDays(current, 1)
  }

  return NextResponse.json({ availability: availabilityMap })
}

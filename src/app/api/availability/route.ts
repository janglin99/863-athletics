import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addDays, format } from "date-fns"

const SLOT_DURATION_MINUTES = 30
const FACILITY_TIMEZONE = "America/New_York"

// Build a Date in a specific timezone
function buildDateInTZ(
  dateKey: string,
  hours: number,
  minutes: number,
  tz: string
): Date {
  // Create a date string as if in the target timezone, then let the engine resolve it
  const pad = (n: number) => n.toString().padStart(2, "0")
  const dateStr = `${dateKey}T${pad(hours)}:${pad(minutes)}:00`

  // Use Intl to find the UTC offset for this date/time in the target timezone
  const tempDate = new Date(dateStr + "Z") // treat as UTC temporarily
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  // Get the offset by comparing the local representation
  const parts = formatter.formatToParts(tempDate)
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "0"

  const tzYear = parseInt(getPart("year"))
  const tzMonth = parseInt(getPart("month"))
  const tzDay = parseInt(getPart("day"))
  const tzHour = parseInt(getPart("hour") === "24" ? "0" : getPart("hour"))

  // Build the date using a simpler approach: construct the ISO string with offset
  // We know the target time, so we find what UTC time corresponds to it
  const targetMs = new Date(
    `${dateKey}T${pad(hours)}:${pad(minutes)}:00Z`
  ).getTime()

  // Find the offset: what does the TZ show when it's this UTC time?
  const utcDate = new Date(targetMs)
  const tzStr = utcDate.toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  })
  const tzHourAtUTC = parseInt(tzStr === "24" ? "0" : tzStr)
  const offsetHours = tzHourAtUTC - utcDate.getUTCHours()

  // The actual UTC time for "hours:minutes in tz" = target - offset
  return new Date(targetMs - offsetHours * 3600000)
}

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

    // Build open/close times in Eastern Time
    const dayOpen = buildDateInTZ(dateKey, openH, openM, FACILITY_TIMEZONE)
    const dayClose = buildDateInTZ(dateKey, closeH, closeM, FACILITY_TIMEZONE)

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

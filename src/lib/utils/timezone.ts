import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz"
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns"

// All facility "day"/"week"/"month" boundaries and displayed dates must be
// anchored to this timezone, not the server process's local timezone (UTC
// on Vercel) or the browser's — otherwise every boundary silently shifts by
// the UTC offset and dates land on the wrong day.
export const FACILITY_TIMEZONE = "America/New_York"

function easternBoundary(instant: Date, boundaryFn: (d: Date) => Date): Date {
  const zoned = toZonedTime(instant, FACILITY_TIMEZONE)
  return fromZonedTime(boundaryFn(zoned), FACILITY_TIMEZONE)
}

export const startOfDayEastern = (instant: Date) =>
  easternBoundary(instant, startOfDay)
export const endOfDayEastern = (instant: Date) =>
  easternBoundary(instant, endOfDay)
export const startOfWeekEastern = (instant: Date) =>
  easternBoundary(instant, (d) => startOfWeek(d, { weekStartsOn: 1 }))
export const endOfWeekEastern = (instant: Date) =>
  easternBoundary(instant, (d) => endOfWeek(d, { weekStartsOn: 1 }))
export const startOfMonthEastern = (instant: Date) =>
  easternBoundary(instant, startOfMonth)
export const endOfMonthEastern = (instant: Date) =>
  easternBoundary(instant, endOfMonth)

// Parses a plain "YYYY-MM-DD" date-picker value (no time/zone info) as the
// start (or end) of that calendar day in the facility's timezone.
export function parseEasternDateOnly(dateString: string): Date {
  return fromZonedTime(`${dateString} 00:00:00`, FACILITY_TIMEZONE)
}

export function parseEasternDateOnlyEnd(dateString: string): Date {
  return fromZonedTime(`${dateString} 23:59:59.999`, FACILITY_TIMEZONE)
}

export function formatEastern(date: Date | string, formatStr: string): string {
  return formatInTimeZone(new Date(date), FACILITY_TIMEZONE, formatStr)
}

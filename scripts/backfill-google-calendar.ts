// One-off: push every active booking with a session on/after a start date to
// Google Calendar. Safe to re-run — syncBookingToCalendar is idempotent.
//
//   npx tsx --env-file=.env.local scripts/backfill-google-calendar.ts [YYYY-MM-DD] [--dry-run]
//
// The start date is a facility-local (Eastern) calendar day, default 2026-11-02.
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { syncBookingToCalendar } from "@/lib/google-calendar/sync"
import { parseEasternDateOnly } from "@/lib/utils/timezone"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const startDate = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? "2026-11-02"

async function main() {
  const missing = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_CALENDAR_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  ].filter((k) => !process.env[k])
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`)

  const from = parseEasternDateOnly(startDate).toISOString()
  const supabase = getSupabaseAdmin()

  // Page through slots (PostgREST caps responses at 1000 rows).
  const bookingIds = new Set<string>()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("booking_slots")
      .select("booking_id, bookings!inner(status)")
      .gte("start_time", from)
      .neq("status", "cancelled")
      .not("bookings.status", "in", "(cancelled,refunded)")
      .order("start_time")
      .range(offset, offset + 999)
    if (error) throw error
    for (const row of data ?? []) bookingIds.add(row.booking_id)
    if (!data || data.length < 1000) break
  }

  console.log(
    `${bookingIds.size} bookings with sessions from ${startDate} (${from}) onward`
  )
  if (dryRun) return console.log("--dry-run: nothing synced")

  let done = 0
  for (const id of bookingIds) {
    await syncBookingToCalendar(id)
    console.log(`[${++done}/${bookingIds.size}] ${id}`)
    // Stay well under Google's per-user write rate limit.
    await new Promise((r) => setTimeout(r, 250))
  }
  console.log("Done. Any failures are logged above as 'Google Calendar sync failed'.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

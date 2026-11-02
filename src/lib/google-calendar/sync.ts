import { createHash, createSign } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { FACILITY_TIMEZONE } from "@/lib/utils/timezone"

// One-way sync: bookings -> a single Google Calendar. Authenticates as a
// service account, so the target calendar must be shared with the service
// account's email ("Make changes to events"). Everything is a no-op until the
// three GOOGLE_* env vars are set.
//
// Each contiguous run of slots (a "session") becomes one event. Event ids are
// derived from booking + anchor slot, so syncBookingToCalendar is idempotent
// and needs no extra DB table. Events are tagged with a private extended
// property so stale ones (rescheduled / cancelled) can be found and removed.

const CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const SCOPE = "https://www.googleapis.com/auth/calendar.events"

// Statuses that should not occupy the calendar.
const INACTIVE_STATUSES = new Set(["cancelled", "refunded"])

interface Slot {
  id: string
  start_time: string
  end_time: string
  status: string
}

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  )
}

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url")

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = b64url(
    JSON.stringify({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  )
  // Env vars store the key with literal "\n" sequences.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(
    /\\n/g,
    "\n"
  )
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(privateKey)

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token request failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return json.access_token
}

async function gcal(path: string, init: RequestInit = {}) {
  const token = await getAccessToken()
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)
  return fetch(`${CALENDAR_API}/calendars/${calendarId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
}

// Google event ids must be 5-1024 chars of a-v and 0-9; hex qualifies.
function eventId(bookingId: string, anchorSlotId: string) {
  return createHash("sha1").update(`${bookingId}:${anchorSlotId}`).digest("hex")
}

async function listBookingEventIds(bookingId: string): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `bookingId=${bookingId}`,
      showDeleted: "false",
      maxResults: "250",
    })
    if (pageToken) params.set("pageToken", pageToken)
    const res = await gcal(`/events?${params}`)
    if (!res.ok) {
      throw new Error(`Google list events failed: ${res.status} ${await res.text()}`)
    }
    const json = (await res.json()) as {
      items?: { id: string }[]
      nextPageToken?: string
    }
    ids.push(...(json.items ?? []).map((e) => e.id))
    pageToken = json.nextPageToken
  } while (pageToken)
  return ids
}

async function deleteEvent(id: string) {
  const res = await gcal(`/events/${id}`, { method: "DELETE" })
  // 404 / 410: already gone.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google delete event failed: ${res.status} ${await res.text()}`)
  }
}

async function upsertEvent(id: string, body: Record<string, unknown>) {
  const payload = JSON.stringify({ ...body, id, status: "confirmed" })
  // PUT revives a previously-deleted event with the same id; 404 means it
  // never existed, so insert it.
  let res = await gcal(`/events/${id}`, { method: "PUT", body: payload })
  if (res.status === 404) {
    res = await gcal("/events", { method: "POST", body: payload })
  }
  if (!res.ok) {
    throw new Error(`Google upsert event failed: ${res.status} ${await res.text()}`)
  }
}

function mergeSessions(slots: Slot[]) {
  const sorted = [...slots].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
  const sessions: { start: string; end: string; anchorSlotId: string }[] = []
  for (const slot of sorted) {
    const last = sessions[sessions.length - 1]
    if (last && new Date(last.end).getTime() === new Date(slot.start_time).getTime()) {
      last.end = slot.end_time
    } else {
      sessions.push({
        start: slot.start_time,
        end: slot.end_time,
        anchorSlotId: slot.id,
      })
    }
  }
  return sessions
}

type Named = { first_name: string | null; last_name: string | null } | null

// The join type is an array or object depending on how supabase infers it.
function one<T>(v: unknown): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null
}

function fullName(p: Named) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(" ") || null
}

export async function syncBookingToCalendar(bookingId: string) {
  if (!isConfigured()) return

  try {
    const { data: booking } = await getSupabaseAdmin()
      .from("bookings")
      .select(
        "id, booking_number, status, participant_count, notes, customer:profiles!customer_id(first_name, last_name), trainer:profiles!trainer_id(first_name, last_name), rate:rates(name), slots:booking_slots(id, start_time, end_time, status)"
      )
      .eq("id", bookingId)
      .maybeSingle()

    // Booking gone or inactive: clear anything we previously created.
    const slots = ((booking?.slots as Slot[] | undefined) ?? []).filter(
      (s) => s.status !== "cancelled"
    )
    if (!booking || INACTIVE_STATUSES.has(booking.status) || slots.length === 0) {
      await removeBookingFromCalendar(bookingId)
      return
    }

    const customer = fullName(one<Named>(booking.customer))
    const trainer = fullName(one<Named>(booking.trainer))
    const rateName = one<{ name: string }>(booking.rate)?.name ?? "Booking"
    const pending = booking.status === "pending_payment"
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://863athletics.com"

    const summary = [
      pending ? "[Pending]" : null,
      rateName,
      customer ? `– ${customer}` : null,
    ]
      .filter(Boolean)
      .join(" ")

    const description = [
      `Booking #${booking.booking_number} (${booking.status.replace(/_/g, " ")})`,
      customer && `Customer: ${customer}`,
      trainer && `Trainer: ${trainer}`,
      `Participants: ${booking.participant_count ?? 1}`,
      booking.notes && `Notes: ${booking.notes}`,
      `${baseUrl}/admin/bookings/${booking.id}`,
    ]
      .filter(Boolean)
      .join("\n")

    const sessions = mergeSessions(slots)
    const wanted = new Set<string>()

    for (const session of sessions) {
      const id = eventId(booking.id, session.anchorSlotId)
      wanted.add(id)
      await upsertEvent(id, {
        summary,
        description,
        location: "863 Athletics, 2195 S 30th St, Haines City, FL 33844",
        start: { dateTime: session.start, timeZone: FACILITY_TIMEZONE },
        end: { dateTime: session.end, timeZone: FACILITY_TIMEZONE },
        extendedProperties: { private: { bookingId: booking.id } },
      })
    }

    // Drop events for sessions that no longer exist (reschedule, slot edit).
    for (const existing of await listBookingEventIds(booking.id)) {
      if (!wanted.has(existing)) await deleteEvent(existing)
    }
  } catch (error) {
    // Calendar sync must never break booking flows.
    console.error(`Google Calendar sync failed for booking ${bookingId}:`, error)
  }
}

export async function removeBookingFromCalendar(bookingId: string) {
  if (!isConfigured()) return
  try {
    for (const id of await listBookingEventIds(bookingId)) {
      await deleteEvent(id)
    }
  } catch (error) {
    console.error(`Google Calendar removal failed for booking ${bookingId}:`, error)
  }
}

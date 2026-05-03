import { Seam } from "seam"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/resend/client"
import { sendSMS } from "@/lib/twilio/client"

interface BookingSlot {
  id: string
  start_time: string
  end_time: string
  status: string
}

const FACILITY_TZ = "America/New_York"

function formatLocal(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: FACILITY_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatLocalTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: FACILITY_TZ,
    hour: "numeric",
    minute: "2-digit",
  })
}

export async function generateAccessCodes(bookingId: string) {
  if (!process.env.SEAM_API_KEY || !process.env.SEAM_IGLOOHOME_DEVICE_ID) return

  const supabaseAdmin = getSupabaseAdmin()
  const seam = new Seam({ apiKey: process.env.SEAM_API_KEY })
  const deviceId = process.env.SEAM_IGLOOHOME_DEVICE_ID

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("*, slots:booking_slots(*)")
    .eq("id", bookingId)
    .single()

  if (!booking) return

  const slots: BookingSlot[] = (booking.slots || [])
    .filter((s: BookingSlot) => s.status !== "cancelled")
    .sort(
      (a: BookingSlot, b: BookingSlot) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )

  if (slots.length === 0) return

  // Avoid duplicate codes when this is rerun (e.g., admin clicks
  // "Regenerate" on a booking that already has codes for some sessions).
  // We only skip sessions whose anchor slot already has a non-failed code.
  const { data: existingCodes } = await supabaseAdmin
    .from("access_codes")
    .select("booking_slot_id")
    .eq("booking_id", bookingId)
    .neq("status", "failed")
  const existingSlotIds = new Set(
    (existingCodes ?? []).map((c) => c.booking_slot_id)
  )

  // Merge consecutive slots into sessions
  const sessions: { start: Date; end: Date; slotId: string }[] = []
  let cur = {
    start: new Date(slots[0].start_time),
    end: new Date(slots[0].end_time),
    slotId: slots[0].id,
  }

  for (let i = 1; i < slots.length; i++) {
    const slotStart = new Date(slots[i].start_time)
    if (slotStart.getTime() === cur.end.getTime()) {
      cur.end = new Date(slots[i].end_time)
    } else {
      sessions.push(cur)
      cur = {
        start: new Date(slots[i].start_time),
        end: new Date(slots[i].end_time),
        slotId: slots[i].id,
      }
    }
  }
  sessions.push(cur)

  for (const session of sessions) {
    if (existingSlotIds.has(session.slotId)) continue
    try {
      const startsAt = new Date(session.start.getTime() - 30 * 60000)
      const endsAt = new Date(session.end.getTime() + 30 * 60000)

      const accessCode = await seam.accessCodes.create({
        device_id: deviceId,
        name: `863-${booking.booking_number}-${session.slotId.slice(0, 8)}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        is_offline_access_code: true,
      })

      // algoPIN may not be in the create response — re-fetch to get it
      let pinCode = accessCode.code
      if (!pinCode) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const fetched = await seam.accessCodes.get({
            access_code_id: accessCode.access_code_id,
          })
          pinCode = fetched.code
        } catch {
          // Will stay as GENERATING
        }
      }

      await supabaseAdmin.from("access_codes").insert({
        booking_id: bookingId,
        booking_slot_id: session.slotId,
        pin_code: pinCode || "GENERATING",
        seam_access_code_id: accessCode.access_code_id,
        seam_device_id: deviceId,
        valid_from: session.start.toISOString(),
        valid_until: session.end.toISOString(),
        status: pinCode ? "active" : "pending",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await supabaseAdmin.from("access_codes").insert({
        booking_id: bookingId,
        booking_slot_id: session.slotId,
        pin_code: "MANUAL_REQUIRED",
        valid_from: session.start.toISOString(),
        valid_until: session.end.toISOString(),
        status: "failed",
        error_message: message,
      })
    }
  }

  await deliverAccessCodes(bookingId)
}

// Notify the customer of any newly-generated access codes via email + SMS
// based on their notification prefs. Marks each row's sent_email / sent_sms
// flag on success so we don't re-send on subsequent calls.
export async function deliverAccessCodes(bookingId: string) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "booking_number, customer:profiles!customer_id(first_name, email, phone, notification_email, notification_sms)"
    )
    .eq("id", bookingId)
    .single()

  // Supabase types this join's relation as an array even though customer_id
  // is a one-to-one FK; coerce to a single record either way.
  type CustomerLite = {
    first_name: string | null
    email: string | null
    phone: string | null
    notification_email: boolean | null
    notification_sms: boolean | null
  }
  const rawCustomer = booking?.customer as unknown
  const customer: CustomerLite | null = Array.isArray(rawCustomer)
    ? (rawCustomer[0] as CustomerLite | undefined) ?? null
    : (rawCustomer as CustomerLite | null)

  if (!booking || !customer) return

  const { data: codes } = await supabaseAdmin
    .from("access_codes")
    .select("id, pin_code, status, valid_from, valid_until, sent_email, sent_sms")
    .eq("booking_id", bookingId)
    .eq("status", "active")

  if (!codes || codes.length === 0) return

  // Filter to codes with a real PIN that haven't been delivered on this
  // channel yet.
  const sortedCodes = codes
    .filter(
      (c) =>
        typeof c.pin_code === "string" &&
        c.pin_code !== "GENERATING" &&
        c.pin_code !== "MANUAL_REQUIRED"
    )
    .sort(
      (a, b) =>
        new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime()
    )

  if (sortedCodes.length === 0) return

  const greeting = customer.first_name ? `Hi ${customer.first_name}` : "Hi"
  const heading =
    sortedCodes.length === 1
      ? "Your access code for 863 Athletics"
      : `Your ${sortedCodes.length} access codes for 863 Athletics`

  const lines = sortedCodes.map((c) => {
    const day = formatLocal(c.valid_from)
    const endTime = formatLocalTime(c.valid_until)
    return `${day} – ${endTime}: PIN ${c.pin_code}`
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://863athletics.com"
  const bookingUrl = `${baseUrl}/bookings/${bookingId}`

  // Email — full breakdown
  const emailCandidates = sortedCodes.filter((c) => !c.sent_email)
  if (
    emailCandidates.length > 0 &&
    customer.notification_email &&
    customer.email
  ) {
    const subject = `${heading} (#${booking.booking_number})`
    const text = [
      `${greeting},`,
      "",
      sortedCodes.length === 1
        ? "Your access code is below. Use the keypad at the entrance."
        : `Each session has its own access code. Use the keypad at the entrance.`,
      "",
      ...lines,
      "",
      `Details: ${bookingUrl}`,
      "",
      "— 863 Athletics",
    ].join("\n")

    try {
      await sendEmail({ to: customer.email, subject, text })
      await supabaseAdmin
        .from("access_codes")
        .update({ sent_email: true })
        .in(
          "id",
          emailCandidates.map((c) => c.id)
        )
    } catch {
      // best-effort; leave sent_email false so a retry can re-attempt
    }
  }

  // SMS — keep short. For multi-session bookings, include up to the next 3
  // upcoming codes; the rest are visible via the link.
  const smsCandidates = sortedCodes.filter((c) => !c.sent_sms)
  if (
    smsCandidates.length > 0 &&
    customer.notification_sms &&
    customer.phone
  ) {
    const head = lines.slice(0, 3).join(" | ")
    const tail =
      sortedCodes.length > 3
        ? ` | +${sortedCodes.length - 3} more — ${bookingUrl}`
        : ""
    const body = `863 Athletics — ${head}${tail}`

    try {
      await sendSMS(customer.phone, body)
      await supabaseAdmin
        .from("access_codes")
        .update({ sent_sms: true })
        .in(
          "id",
          smsCandidates.map((c) => c.id)
        )
    } catch {
      // best-effort
    }
  }
}

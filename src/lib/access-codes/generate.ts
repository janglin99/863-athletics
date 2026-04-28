import { Seam } from "seam"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface BookingSlot {
  id: string
  start_time: string
  end_time: string
  status: string
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
}

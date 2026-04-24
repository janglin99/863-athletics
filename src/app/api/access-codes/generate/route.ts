import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Seam } from "seam"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { bookingId } = await req.json()

    // Get booking with slots
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, slots:booking_slots(*), customer:profiles!customer_id(*)")
      .eq("id", bookingId)
      .single()

    if (!booking)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    if (!process.env.SEAM_API_KEY || !process.env.SEAM_IGLOOHOME_DEVICE_ID) {
      // Seam not configured — create manual code entry
      for (const slot of booking.slots || []) {
        await supabase.from("access_codes").insert({
          booking_id: bookingId,
          booking_slot_id: slot.id,
          pin_code: "MANUAL_REQUIRED",
          valid_from: slot.start_time,
          valid_until: slot.end_time,
          status: "failed",
          error_message: "Seam API not configured",
        })
      }
      return NextResponse.json({ message: "Manual codes required" })
    }

    const seam = new Seam({ apiKey: process.env.SEAM_API_KEY })
    const deviceId = process.env.SEAM_IGLOOHOME_DEVICE_ID

    // Group consecutive slots into sessions (e.g. 6:00-6:30 + 6:30-7:00 = 6:00-7:00)
    const slots = (booking.slots || [])
      .filter((s: any) => s.status !== "cancelled")
      .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    if (slots.length === 0) {
      return NextResponse.json({ message: "No active slots" })
    }

    // Merge into sessions
    const sessions: { start: Date; end: Date; slotIds: string[] }[] = []
    let current = {
      start: new Date(slots[0].start_time),
      end: new Date(slots[0].end_time),
      slotIds: [slots[0].id],
    }

    for (let i = 1; i < slots.length; i++) {
      const slotStart = new Date(slots[i].start_time)
      if (slotStart.getTime() === current.end.getTime()) {
        // Consecutive — extend
        current.end = new Date(slots[i].end_time)
        current.slotIds.push(slots[i].id)
      } else {
        // Gap — new session
        sessions.push(current)
        current = {
          start: new Date(slots[i].start_time),
          end: new Date(slots[i].end_time),
          slotIds: [slots[i].id],
        }
      }
    }
    sessions.push(current)

    const results = []

    for (const session of sessions) {
      // Add 30-min buffer before/after
      const startsAt = new Date(session.start.getTime() - 30 * 60000)
      const endsAt = new Date(session.end.getTime() + 30 * 60000)

      try {
        const accessCode = await seam.accessCodes.create({
          device_id: deviceId,
          name: `863-${booking.booking_number}-${session.slotIds[0].slice(0, 8)}`,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          is_offline_access_code: true,
        })

        // Save to DB — code may be null initially for algoPIN
        const { data: savedCode } = await supabase
          .from("access_codes")
          .insert({
            booking_id: bookingId,
            booking_slot_id: session.slotIds[0],
            pin_code: accessCode.code || "GENERATING",
            seam_access_code_id: accessCode.access_code_id,
            seam_device_id: deviceId,
            valid_from: session.start.toISOString(),
            valid_until: session.end.toISOString(),
            status: accessCode.code ? "active" : "pending",
          })
          .select()
          .single()

        results.push({
          sessionStart: session.start,
          code: accessCode.code,
          accessCodeId: accessCode.access_code_id,
          dbId: savedCode?.id,
          status: accessCode.code ? "active" : "pending",
        })
      } catch (error: any) {
        // Log failure but continue
        await supabase.from("access_codes").insert({
          booking_id: bookingId,
          booking_slot_id: session.slotIds[0],
          pin_code: "MANUAL_REQUIRED",
          valid_from: session.start.toISOString(),
          valid_until: session.end.toISOString(),
          status: "failed",
          error_message: error.message,
        })

        results.push({
          sessionStart: session.start,
          error: error.message,
          status: "failed",
        })
      }
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error("Access code generation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate access codes" },
      { status: 500 }
    )
  }
}

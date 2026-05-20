import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { deliverAccessCodes } from "@/lib/access-codes/generate"
import { Seam } from "seam"

// Promotes `pending` access_codes whose PIN has now surfaced on Seam.
// Igloohome offline codes can take longer than the post-create wait in
// generateAccessCodes() to expose a PIN, so without this nothing ever
// circles back to update them.
//
// Triggered by Vercel Cron (see vercel.json). Vercel cron requests are
// GET and arrive with `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.SEAM_API_KEY) {
    return NextResponse.json({ error: "Seam not configured" }, { status: 500 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: pendingCodes } = await supabaseAdmin
    .from("access_codes")
    .select("id, booking_id, seam_access_code_id")
    .eq("status", "pending")
    .not("seam_access_code_id", "is", null)
    .limit(200)

  if (!pendingCodes || pendingCodes.length === 0) {
    return NextResponse.json({ checked: 0, updated: 0 })
  }

  const seam = new Seam({ apiKey: process.env.SEAM_API_KEY })
  let updated = 0
  const promotedBookingIds = new Set<string>()

  for (const code of pendingCodes) {
    if (!code.seam_access_code_id) continue
    try {
      const seamCode = await seam.accessCodes.get({
        access_code_id: code.seam_access_code_id,
      })
      if (seamCode.code) {
        await supabaseAdmin
          .from("access_codes")
          .update({ pin_code: seamCode.code, status: "active" })
          .eq("id", code.id)
        updated++
        promotedBookingIds.add(code.booking_id)
      }
    } catch {
      // Not ready yet — leave pending for the next tick.
    }
  }

  if (promotedBookingIds.size > 0) {
    after(async () => {
      for (const bookingId of promotedBookingIds) {
        await deliverAccessCodes(bookingId)
      }
    })
  }

  return NextResponse.json({ checked: pendingCodes.length, updated })
}

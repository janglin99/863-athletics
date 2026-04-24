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

    if (!process.env.SEAM_API_KEY) {
      return NextResponse.json({ error: "Seam not configured" }, { status: 500 })
    }

    // Find pending access codes for this user's bookings
    const { data: pendingCodes } = await supabase
      .from("access_codes")
      .select("*, booking:bookings!inner(customer_id)")
      .eq("status", "pending")
      .not("seam_access_code_id", "is", null)

    if (!pendingCodes || pendingCodes.length === 0) {
      return NextResponse.json({ updated: 0 })
    }

    const seam = new Seam({ apiKey: process.env.SEAM_API_KEY })
    let updated = 0

    for (const code of pendingCodes) {
      // Only process codes belonging to the current user (or admin)
      if (code.booking.customer_id !== user.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        if (!profile || !["admin", "staff"].includes(profile.role)) continue
      }

      try {
        const seamCode = await seam.accessCodes.get({
          access_code_id: code.seam_access_code_id,
        })

        if (seamCode.code) {
          await supabase
            .from("access_codes")
            .update({
              pin_code: seamCode.code,
              status: "active",
            })
            .eq("id", code.id)
          updated++
        }
      } catch {
        // Code not ready yet or error — skip
      }
    }

    return NextResponse.json({ updated })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to poll access codes" },
      { status: 500 }
    )
  }
}

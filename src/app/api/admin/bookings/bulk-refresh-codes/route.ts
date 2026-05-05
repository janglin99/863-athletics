import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateAccessCodes } from "@/lib/access-codes/generate"
import { z } from "zod"

const bodySchema = z.object({
  bookingIds: z.array(z.string().uuid()).min(1).max(100),
})

// Runs generateAccessCodes for each selected booking. Idempotent:
// - Slots without a code get one created.
// - Pending (GENERATING) codes get re-polled from Seam and promoted when
//   ready.
// - Active codes are untouched.
// Delivery (email/SMS) fires inside generateAccessCodes for any newly
// active rows.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }
  const { bookingIds } = parsed.data

  const results = await Promise.allSettled(
    bookingIds.map((id) => generateAccessCodes(id))
  )
  const ok = results.filter((r) => r.status === "fulfilled").length
  const failed = results.length - ok
  const failureReasons = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) =>
      r.reason instanceof Error ? r.reason.message : String(r.reason)
    )

  return NextResponse.json({
    refreshed: ok,
    failed,
    failureReasons,
  })
}

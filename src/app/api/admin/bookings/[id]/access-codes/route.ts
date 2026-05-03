import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateAccessCodes } from "@/lib/access-codes/generate"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  // generateAccessCodes is idempotent — sessions that already have an
  // active code are skipped, and deliverAccessCodes only sends to
  // channels that haven't been marked sent yet.
  await generateAccessCodes(id)

  return NextResponse.json({ ok: true })
}

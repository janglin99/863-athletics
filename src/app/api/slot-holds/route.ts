import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slots } = await req.json()
  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: "No slots provided" }, { status: 400 })
  }

  // Fetch hold duration from admin_settings
  const { data: setting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "slot_hold_minutes")
    .single()

  const holdMinutes = setting ? parseInt(setting.value, 10) : 5
  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()

  // Delete any existing holds for this user first
  await supabase.from("slot_holds").delete().eq("customer_id", user.id)

  // Insert new holds
  const holdsToInsert = slots.map((slot: { start: string; end: string }) => ({
    customer_id: user.id,
    start_time: slot.start,
    end_time: slot.end,
    expires_at: expiresAt,
  }))

  const { data: holds, error } = await supabase
    .from("slot_holds")
    .insert(holdsToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ holds, expiresAt, holdMinutes })
}

export async function DELETE() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await supabase.from("slot_holds").delete().eq("customer_id", user.id)

  return NextResponse.json({ success: true })
}

export async function GET() {
  const supabase = await createClient()

  const { data: setting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "slot_hold_minutes")
    .single()

  const holdMinutes = setting ? parseInt(setting.value, 10) : 5

  return NextResponse.json({ holdMinutes })
}

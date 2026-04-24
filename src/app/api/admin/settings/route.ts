import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const { data: settings, error } = await supabase
    .from("admin_settings")
    .select("*")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()

  // Check admin
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

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { key, value } = await req.json()
  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 }
    )
  }

  const { data: setting, error } = await supabase
    .from("admin_settings")
    .upsert(
      { key, value: String(value), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ setting })
}

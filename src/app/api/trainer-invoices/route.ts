import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const isAdmin = ["admin", "staff"].includes(profile.role)
  const isTrainer = profile.role === "trainer"

  if (!isAdmin && !isTrainer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const trainerId = searchParams.get("trainerId")
  const month = searchParams.get("month")
  const year = searchParams.get("year")

  let query = supabase
    .from("trainer_invoices")
    .select("*, trainer:profiles!trainer_id(*), items:invoice_items(*)")
    .order("year", { ascending: false })
    .order("month", { ascending: false })

  // Trainers can only see their own
  if (!isAdmin) {
    query = query.eq("trainer_id", user.id)
  } else if (trainerId) {
    query = query.eq("trainer_id", trainerId)
  }

  if (month) query = query.eq("month", parseInt(month))
  if (year) query = query.eq("year", parseInt(year))

  const { data: invoices, error } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }

  return NextResponse.json(invoices || [])
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { invoiceId, status } = await req.json()

  if (!invoiceId || !status) {
    return NextResponse.json(
      { error: "invoiceId and status are required" },
      { status: 400 }
    )
  }

  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === "paid") {
    payload.paid_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("trainer_invoices")
    .update(payload)
    .eq("id", invoiceId)

  if (error) {
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

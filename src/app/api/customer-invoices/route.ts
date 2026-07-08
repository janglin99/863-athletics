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
  const requestedCustomerId = req.nextUrl.searchParams.get("customerId")
  const customerId = isAdmin ? requestedCustomerId || user.id : user.id

  const { data, error } = await supabase
    .from("customer_invoices")
    .select("*, customer:profiles!customer_id(*), items:customer_invoice_items(*)")
    .eq("customer_id", customerId)
    .order("period_start", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
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

  const { invoiceId } = await req.json()
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("customer_invoices")
    .delete()
    .eq("id", invoiceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

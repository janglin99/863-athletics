import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { recomputeInvoicePaidCents } from "@/lib/invoices/recompute"

const PAYMENT_METHODS = ["cash", "check", "zelle", "cash_app", "card", "other"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { amountCents, method, note, paidAt } = await req.json()

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json(
      { error: "amountCents must be a positive number" },
      { status: 400 }
    )
  }
  if (method && !PAYMENT_METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 })
  }

  const { data: invoice } = await supabase
    .from("customer_invoices")
    .select("id")
    .eq("id", id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const { error: insertError } = await supabase
    .from("customer_invoice_payments")
    .insert({
      invoice_id: id,
      amount_cents: amountCents,
      method: method || "other",
      note: note || null,
      recorded_by: user.id,
      paid_at: paidAt || new Date().toISOString(),
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  await recomputeInvoicePaidCents(supabase, id)

  const { data: updated } = await supabase
    .from("customer_invoices")
    .select(
      "*, customer:profiles!customer_id(*), items:customer_invoice_items(*), payments:customer_invoice_payments(*)"
    )
    .eq("id", id)
    .single()

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { paymentId } = await req.json()
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("customer_invoice_payments")
    .delete()
    .eq("id", paymentId)
    .eq("invoice_id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recomputeInvoicePaidCents(supabase, id)

  const { data: updated } = await supabase
    .from("customer_invoices")
    .select(
      "*, customer:profiles!customer_id(*), items:customer_invoice_items(*), payments:customer_invoice_payments(*)"
    )
    .eq("id", id)
    .single()

  return NextResponse.json(updated)
}

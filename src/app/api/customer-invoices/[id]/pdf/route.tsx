import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createClient } from "@/lib/supabase/server"
import { CustomerInvoiceDocument } from "@/lib/pdf/CustomerInvoiceDocument"
import type { CustomerInvoice, Profile } from "@/types"

export async function GET(
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

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: invoice, error } = await supabase
    .from("customer_invoices")
    .select(
      "*, customer:profiles!customer_id(*), items:customer_invoice_items(*), payments:customer_invoice_payments(*)"
    )
    .eq("id", id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const isAdmin = ["admin", "staff"].includes(profile.role)
  if (!isAdmin && invoice.customer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const typedInvoice = invoice as CustomerInvoice
  const customer = typedInvoice.customer as Profile

  const buffer = await renderToBuffer(
    <CustomerInvoiceDocument invoice={typedInvoice} customer={customer} />
  )

  const download = req.nextUrl.searchParams.get("download") === "1"

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${typedInvoice.invoice_number}.pdf"`,
    },
  })
}

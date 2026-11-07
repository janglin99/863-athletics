import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireShopAccess } from "@/lib/shop/auth"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { getStripeServer } from "@/lib/stripe/server"
import { SHIRT } from "@/lib/shop/products"

const bodySchema = z.object({ fulfilled: z.boolean() })

// Mark a shop order fulfilled (shipped / picked up), or undo it.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireShopAccess()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !id.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Only real, paid shop orders can be marked.
  try {
    const session = await getStripeServer().checkout.sessions.retrieve(id)
    if (
      session.payment_status !== "paid" ||
      session.metadata?.product !== SHIRT.slug
    ) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const db = getSupabaseAdmin()
  if (parsed.data.fulfilled) {
    const fulfilledAt = new Date().toISOString()
    const { error } = await db.from("shop_order_fulfillment").upsert(
      { session_id: id, fulfilled_at: fulfilledAt, fulfilled_by: auth.userId },
      { onConflict: "session_id" }
    )
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ fulfilledAt })
  }

  const { error } = await db
    .from("shop_order_fulfillment")
    .delete()
    .eq("session_id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ fulfilledAt: null })
}

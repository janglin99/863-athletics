import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { requireShopAccess } from "@/lib/shop/auth"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { getStripeServer } from "@/lib/stripe/server"
import { SHIRT } from "@/lib/shop/products"

export const dynamic = "force-dynamic"

export interface ShopOrder {
  id: string
  ref: string
  createdAt: string
  name: string | null
  email: string | null
  phone: string | null
  size: string
  quantity: number
  fulfillment: "ship" | "pickup"
  shippingAddress: string | null
  pickupAddress: string | null
  subtotalCents: number
  shippingCents: number
  totalCents: number
  refunded: boolean
  paymentIntentId: string | null
  fulfilledAt: string | null
}

function formatAddress(a: Stripe.Address | null | undefined) {
  if (!a) return null
  return [
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n")
}

// Shop orders aren't stored in our database; Stripe is the source of truth.
// We list recent Checkout Sessions and keep the paid ones for the shirt.
export async function GET() {
  const auth = await requireShopAccess()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const stripe = getStripeServer()
    const orders: ShopOrder[] = []
    const MAX_SESSIONS = 500

    let scanned = 0
    for await (const s of stripe.checkout.sessions.list({
      limit: 100,
      expand: ["data.payment_intent.latest_charge"],
    })) {
      if (++scanned > MAX_SESSIONS) break
      if (s.payment_status !== "paid") continue
      if (s.metadata?.product !== SHIRT.slug) continue

      const pi =
        s.payment_intent && typeof s.payment_intent !== "string"
          ? s.payment_intent
          : null
      const charge =
        pi?.latest_charge && typeof pi.latest_charge !== "string"
          ? pi.latest_charge
          : null
      const total = s.amount_total ?? 0
      const shippingCents = s.total_details?.amount_shipping ?? 0
      const isPickup = s.metadata?.fulfillment === "pickup"

      orders.push({
        id: s.id,
        ref: s.id.slice(-8).toUpperCase(),
        createdAt: new Date(s.created * 1000).toISOString(),
        name: s.customer_details?.name ?? null,
        email: s.customer_details?.email ?? null,
        phone: s.customer_details?.phone ?? null,
        size: s.metadata?.size ?? "",
        quantity: Number(s.metadata?.quantity ?? 1),
        fulfillment: isPickup ? "pickup" : "ship",
        shippingAddress: formatAddress(
          s.collected_information?.shipping_details?.address
        ),
        pickupAddress: s.metadata?.pickup_address ?? null,
        subtotalCents: total - shippingCents,
        shippingCents,
        totalCents: total,
        refunded: !!charge && charge.refunded,
        paymentIntentId: pi?.id ?? null,
        fulfilledAt: null,
      })
    }

    const { data: done } = await getSupabaseAdmin()
      .from("shop_order_fulfillment")
      .select("session_id, fulfilled_at")
      .in(
        "session_id",
        orders.map((o) => o.id)
      )
    const fulfilledAt = new Map(
      (done ?? []).map((d) => [d.session_id, d.fulfilled_at as string])
    )
    for (const o of orders) o.fulfilledAt = fulfilledAt.get(o.id) ?? null

    return NextResponse.json({ orders })
  } catch (error) {
    console.error("Admin orders error:", error)
    return NextResponse.json(
      { error: "Could not load orders from Stripe" },
      { status: 500 }
    )
  }
}

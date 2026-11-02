import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { MAX_PICKUP_ADDRESS_LENGTH, SHIRT_SIZES } from "@/lib/shop/products"
import {
  PICKUP_ADDRESS_KEY,
  PICKUP_ENABLED_KEY,
  SHIPPING_ENABLED_KEY,
  SHIPPING_KEY,
  getShopConfig,
  priceKey,
  soldOutKey,
} from "@/lib/shop/config"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized", status: 401 as const }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const }
  }
  return { supabase }
}

export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  return NextResponse.json(await getShopConfig())
}

const saveSchema = z.object({
  shippingCents: z.number().int().min(0).max(10_000),
  shippingEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  pickupAddress: z.string().trim().max(MAX_PICKUP_ADDRESS_LENGTH),
  sizes: z
    .array(
      z.object({
        code: z.string(),
        priceCents: z.number().int().min(100).max(100_000),
        soldOut: z.boolean(),
      })
    )
    .min(1),
})

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Prices must be $1.00–$1,000.00 and the pickup address under 300 characters" },
      { status: 400 }
    )
  }

  if (!parsed.data.shippingEnabled && !parsed.data.pickupEnabled) {
    return NextResponse.json(
      { error: "Enable shipping, pickup, or both" },
      { status: 400 }
    )
  }
  if (parsed.data.pickupEnabled && !parsed.data.pickupAddress) {
    return NextResponse.json(
      { error: "Enter a pickup address" },
      { status: 400 }
    )
  }

  const known = new Set(SHIRT_SIZES.map((s) => s.code))
  if (parsed.data.sizes.some((s) => !known.has(s.code))) {
    return NextResponse.json({ error: "Unknown size" }, { status: 400 })
  }

  const now = new Date().toISOString()
  const rows = [
    { key: SHIPPING_KEY, value: String(parsed.data.shippingCents) },
    { key: SHIPPING_ENABLED_KEY, value: String(parsed.data.shippingEnabled) },
    { key: PICKUP_ENABLED_KEY, value: String(parsed.data.pickupEnabled) },
    { key: PICKUP_ADDRESS_KEY, value: parsed.data.pickupAddress },
    ...parsed.data.sizes.flatMap((s) => [
      { key: priceKey(s.code), value: String(s.priceCents) },
      { key: soldOutKey(s.code), value: String(s.soldOut) },
    ]),
  ].map((r) => ({ ...r, updated_at: now }))

  const { error } = await auth.supabase
    .from("admin_settings")
    .upsert(rows, { onConflict: "key" })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(await getShopConfig())
}

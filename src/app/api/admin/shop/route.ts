import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireShopAccess } from "@/lib/shop/auth"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_GROUP_LENGTH,
  MAX_PICKUP_ADDRESS_LENGTH,
  MAX_SIZES,
  SIZE_CODE_PATTERN,
} from "@/lib/shop/products"
import {
  DESCRIPTION_KEY,
  PICKUP_ADDRESS_KEY,
  PICKUP_ENABLED_KEY,
  SHIPPING_ENABLED_KEY,
  SHIPPING_KEY,
  SIZES_KEY,
  getShopConfig,
} from "@/lib/shop/config"

export async function GET() {
  const auth = await requireShopAccess()
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
  description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH),
  sizes: z
    .array(
      z.object({
        code: z.string().trim().regex(SIZE_CODE_PATTERN),
        label: z.string().trim().max(40),
        group: z.string().trim().max(MAX_GROUP_LENGTH).optional(),
        priceCents: z.number().int().min(100).max(100_000),
        soldOut: z.boolean(),
      })
    )
    .min(1)
    .max(MAX_SIZES),
})

export async function PUT(req: NextRequest) {
  const auth = await requireShopAccess()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Check the form: description is required, each size needs a short code (letters/numbers) and a price of $1.00–$1,000.00",
      },
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

  const codes = parsed.data.sizes.map((s) => s.code.toLowerCase())
  if (new Set(codes).size !== codes.length) {
    return NextResponse.json(
      { error: "Each size code must be unique" },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const rows = [
    { key: SHIPPING_KEY, value: String(parsed.data.shippingCents) },
    { key: SHIPPING_ENABLED_KEY, value: String(parsed.data.shippingEnabled) },
    { key: PICKUP_ENABLED_KEY, value: String(parsed.data.pickupEnabled) },
    { key: PICKUP_ADDRESS_KEY, value: parsed.data.pickupAddress },
    { key: DESCRIPTION_KEY, value: parsed.data.description },
    {
      key: SIZES_KEY,
      value: JSON.stringify(
        parsed.data.sizes.map((s) => ({ ...s, label: s.label || s.code }))
      ),
    },
  ].map((r) => ({ ...r, updated_at: now }))

  // Service role: shop managers can't write admin_settings under RLS, and
  // access was already verified above.
  const { error } = await getSupabaseAdmin()
    .from("admin_settings")
    .upsert(rows, { onConflict: "key" })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(await getShopConfig())
}

import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  DEFAULT_PICKUP_ADDRESS,
  SHIRT,
  SIZE_CODE_PATTERN,
  SHIPPING_CENTS,
  SHIRT_SIZES,
  type ShirtSize,
} from "./products"

// Shop prices / availability are editable at /admin/shop and stored in the
// admin_settings key/value table:
//   shop_sizes            JSON array of { code, label, priceCents, soldOut }
//   shop_description      product blurb shown on the shop page
//   shop_price_<SIZE>, shop_soldout_<SIZE>  legacy per-size keys, only used
//                         until shop_sizes is first saved
//   shop_shipping_cents   flat shipping in cents
//   shop_shipping_enabled "true" / "false" (default true)
//   shop_pickup_enabled   "true" / "false" (default false)
//   shop_pickup_address   free text shown to customers
// Anything not set falls back to the defaults in products.ts.

export interface ShopSize extends ShirtSize {
  soldOut: boolean
}

export interface ShopConfig {
  description: string
  sizes: ShopSize[]
  shippingCents: number
  shippingEnabled: boolean
  pickupEnabled: boolean
  pickupAddress: string
}

export const priceKey = (code: string) => `shop_price_${code}`
export const soldOutKey = (code: string) => `shop_soldout_${code}`
export const SIZES_KEY = "shop_sizes"
export const DESCRIPTION_KEY = "shop_description"
export const SHIPPING_KEY = "shop_shipping_cents"
export const SHIPPING_ENABLED_KEY = "shop_shipping_enabled"
export const PICKUP_ENABLED_KEY = "shop_pickup_enabled"
export const PICKUP_ADDRESS_KEY = "shop_pickup_address"

export async function getShopConfig(): Promise<ShopConfig> {
  const { data } = await getSupabaseAdmin()
    .from("admin_settings")
    .select("key, value")
    .like("key", "shop_%")

  const settings = new Map((data ?? []).map((r) => [r.key, r.value]))
  const intOr = (raw: string | undefined, fallback: number) => {
    const n = raw === undefined ? NaN : parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }

  const legacySizes = (): ShopSize[] =>
    SHIRT_SIZES.map((s) => ({
      ...s,
      priceCents: intOr(settings.get(priceKey(s.code)), s.priceCents),
      soldOut: settings.get(soldOutKey(s.code)) === "true",
    }))

  return {
    description: settings.get(DESCRIPTION_KEY)?.trim() || SHIRT.description,
    sizes: parseSizes(settings.get(SIZES_KEY)) ?? legacySizes(),
    shippingCents: intOr(settings.get(SHIPPING_KEY), SHIPPING_CENTS),
    // Shipping is on unless explicitly disabled; pickup is off unless enabled.
    shippingEnabled: settings.get(SHIPPING_ENABLED_KEY) !== "false",
    pickupEnabled: settings.get(PICKUP_ENABLED_KEY) === "true",
    pickupAddress:
      settings.get(PICKUP_ADDRESS_KEY)?.trim() || DEFAULT_PICKUP_ADDRESS,
  }
}

// Returns null when unset/invalid so callers fall back to the defaults.
function parseSizes(raw: string | undefined): ShopSize[] | null {
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || arr.length === 0) return null
    const sizes: ShopSize[] = []
    for (const s of arr) {
      if (
        typeof s?.code !== "string" ||
        !SIZE_CODE_PATTERN.test(s.code) ||
        !Number.isInteger(s.priceCents) ||
        s.priceCents < 0
      ) {
        return null
      }
      sizes.push({
        code: s.code,
        label: typeof s.label === "string" && s.label ? s.label : s.code,
        priceCents: s.priceCents,
        soldOut: s.soldOut === true,
      })
    }
    return sizes
  } catch {
    return null
  }
}

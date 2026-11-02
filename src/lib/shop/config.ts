import { getSupabaseAdmin } from "@/lib/supabase/admin"
import {
  DEFAULT_PICKUP_ADDRESS,
  SHIPPING_CENTS,
  SHIRT_SIZES,
  type ShirtSize,
} from "./products"

// Shop prices / availability are editable at /admin/shop and stored in the
// admin_settings key/value table:
//   shop_price_<SIZE>     price in cents
//   shop_soldout_<SIZE>   "true" when sold out
//   shop_shipping_cents   flat shipping in cents
//   shop_shipping_enabled "true" / "false" (default true)
//   shop_pickup_enabled   "true" / "false" (default false)
//   shop_pickup_address   free text shown to customers
// Anything not set falls back to the defaults in products.ts.

export interface ShopSize extends ShirtSize {
  soldOut: boolean
}

export interface ShopConfig {
  sizes: ShopSize[]
  shippingCents: number
  shippingEnabled: boolean
  pickupEnabled: boolean
  pickupAddress: string
}

export const priceKey = (code: string) => `shop_price_${code}`
export const soldOutKey = (code: string) => `shop_soldout_${code}`
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

  return {
    sizes: SHIRT_SIZES.map((s) => ({
      ...s,
      priceCents: intOr(settings.get(priceKey(s.code)), s.priceCents),
      soldOut: settings.get(soldOutKey(s.code)) === "true",
    })),
    shippingCents: intOr(settings.get(SHIPPING_KEY), SHIPPING_CENTS),
    // Shipping is on unless explicitly disabled; pickup is off unless enabled.
    shippingEnabled: settings.get(SHIPPING_ENABLED_KEY) !== "false",
    pickupEnabled: settings.get(PICKUP_ENABLED_KEY) === "true",
    pickupAddress:
      settings.get(PICKUP_ADDRESS_KEY)?.trim() || DEFAULT_PICKUP_ADDRESS,
  }
}

// Single-product shop definition. The prices and shipping below are only the
// DEFAULTS — the live values are edited at /admin/shop and loaded server-side
// by getShopConfig() (see config.ts), which is what checkout charges.

import { FACILITY } from "@/lib/constants/facility"

export interface ShirtSize {
  code: string
  label: string
  priceCents: number
}

export const SHIRT = {
  slug: "respect-da-city-cuh-tee",
  name: "Respect Da City Cuh Tee",
  image: "/images/respect-da-city-tee.jpg",
  description:
    "Rep the 863 in black with the full-front Respect Da City Cuh graphic in bold green and white.",
}

export const SHIRT_SIZES: ShirtSize[] = [
  { code: "S", label: "Small", priceCents: 3000 },
  { code: "M", label: "Medium", priceCents: 3000 },
  { code: "L", label: "Large", priceCents: 3000 },
  { code: "XL", label: "X-Large", priceCents: 3000 },
  { code: "2XL", label: "2X-Large", priceCents: 3300 },
  { code: "3XL", label: "3X-Large", priceCents: 3500 },
]

export const SHIPPING_CENTS = 500
export const DEFAULT_PICKUP_ADDRESS = `${FACILITY.name}\n${FACILITY.addressLine1}\n${FACILITY.addressLine2}`
export const MAX_PICKUP_ADDRESS_LENGTH = 300
export const MAX_QUANTITY = 10
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_SIZES = 20
// Size codes are shown on buttons and in emails/Stripe, so keep them short.
export const SIZE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./-]{0,11}$/

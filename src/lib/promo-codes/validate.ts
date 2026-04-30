import type { SupabaseClient } from "@supabase/supabase-js"

export interface PromoCodeRecord {
  id: string
  code: string
  discount_type: "percentage" | "fixed_amount" | "fixed_rate_per_hour"
  discount_value: number
  min_booking_cents: number | null
  max_discount_cents: number | null
  usage_limit: number | null
  usage_count: number
  valid_from: string | null
  valid_until: string | null
  applicable_rate_types: string[] | null
  is_active: boolean
}

export interface ValidatePromoArgs {
  code: string
  rateType?: string | null
  subtotalCents?: number | null
  // Required for fixed_rate_per_hour codes — used to compute the new total as
  // hours × discount_value (cents). Ignored for other discount types.
  hours?: number | null
}

export type ValidatePromoResult =
  | { valid: false; error: string }
  | {
      valid: true
      promo: PromoCodeRecord
      discount: {
        type: PromoCodeRecord["discount_type"]
        value: number
        amountOff: number
      }
    }

export async function validatePromoCode(
  supabase: SupabaseClient,
  args: ValidatePromoArgs
): Promise<ValidatePromoResult> {
  const code = args.code?.trim()
  if (!code) {
    return { valid: false, error: "Code is required" }
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .ilike("code", code)
    .single()

  if (error || !data) {
    return { valid: false, error: "Invalid promo code" }
  }
  const promo = data as PromoCodeRecord

  if (!promo.is_active) {
    return { valid: false, error: "This promo code is no longer active" }
  }

  const now = new Date()
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return { valid: false, error: "This promo code is not yet valid" }
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return { valid: false, error: "This promo code has expired" }
  }

  if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
    return { valid: false, error: "This promo code has reached its usage limit" }
  }

  if (
    promo.applicable_rate_types &&
    promo.applicable_rate_types.length > 0 &&
    args.rateType &&
    !promo.applicable_rate_types.includes(args.rateType)
  ) {
    return {
      valid: false,
      error: "This promo code does not apply to the selected rate type",
    }
  }

  if (
    promo.min_booking_cents &&
    args.subtotalCents !== undefined &&
    args.subtotalCents !== null &&
    args.subtotalCents < promo.min_booking_cents
  ) {
    return {
      valid: false,
      error: `Minimum booking amount is $${(promo.min_booking_cents / 100).toFixed(2)}`,
    }
  }

  let amountOff = 0
  if (promo.discount_type === "percentage") {
    amountOff = Math.round(((args.subtotalCents ?? 0) * promo.discount_value) / 100)
    if (promo.max_discount_cents && amountOff > promo.max_discount_cents) {
      amountOff = promo.max_discount_cents
    }
  } else if (promo.discount_type === "fixed_amount") {
    amountOff = promo.discount_value
  } else if (promo.discount_type === "fixed_rate_per_hour") {
    // Replace the normal rate with discount_value (cents) per hour.
    if (
      args.hours !== undefined &&
      args.hours !== null &&
      args.subtotalCents !== undefined &&
      args.subtotalCents !== null
    ) {
      const newTotalCents = Math.round(args.hours * promo.discount_value)
      amountOff = Math.max(0, args.subtotalCents - newTotalCents)
    } else {
      return {
        valid: false,
        error: "Cannot apply per-hour promo without booking hours",
      }
    }
  }

  if (args.subtotalCents !== undefined && args.subtotalCents !== null) {
    amountOff = Math.min(amountOff, args.subtotalCents)
  }

  return {
    valid: true,
    promo,
    discount: {
      type: promo.discount_type,
      value: promo.discount_value,
      amountOff,
    },
  }
}

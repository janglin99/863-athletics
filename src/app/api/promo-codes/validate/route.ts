import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { code, rateType, subtotalCents } = await req.json()

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { valid: false, error: "Code is required" },
      { status: 400 }
    )
  }

  // Look up the code (case-insensitive)
  const { data: promo, error } = await supabase
    .from("promo_codes")
    .select("*")
    .ilike("code", code.trim())
    .single()

  if (error || !promo) {
    return NextResponse.json({
      valid: false,
      error: "Invalid promo code",
    })
  }

  // Check is_active
  if (!promo.is_active) {
    return NextResponse.json({
      valid: false,
      error: "This promo code is no longer active",
    })
  }

  // Check valid_from / valid_until
  const now = new Date()
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return NextResponse.json({
      valid: false,
      error: "This promo code is not yet valid",
    })
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return NextResponse.json({
      valid: false,
      error: "This promo code has expired",
    })
  }

  // Check usage_limit vs usage_count
  if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
    return NextResponse.json({
      valid: false,
      error: "This promo code has reached its usage limit",
    })
  }

  // Check applicable_rate_types
  if (
    promo.applicable_rate_types &&
    promo.applicable_rate_types.length > 0 &&
    rateType &&
    !promo.applicable_rate_types.includes(rateType)
  ) {
    return NextResponse.json({
      valid: false,
      error: "This promo code does not apply to the selected rate type",
    })
  }

  // Check min_booking_cents
  if (
    promo.min_booking_cents &&
    subtotalCents &&
    subtotalCents < promo.min_booking_cents
  ) {
    return NextResponse.json({
      valid: false,
      error: `Minimum booking amount is $${(promo.min_booking_cents / 100).toFixed(2)}`,
    })
  }

  // Calculate discount amount
  let amountOff = 0
  if (promo.discount_type === "percentage") {
    amountOff = Math.round((subtotalCents || 0) * promo.discount_value / 100)
    if (promo.max_discount_cents && amountOff > promo.max_discount_cents) {
      amountOff = promo.max_discount_cents
    }
  } else if (promo.discount_type === "fixed_amount") {
    amountOff = promo.discount_value
  }
  // fixed_rate_per_hour is handled client-side (replaces the rate)

  return NextResponse.json({
    valid: true,
    discount: {
      type: promo.discount_type,
      value: promo.discount_value,
      amountOff,
    },
  })
}

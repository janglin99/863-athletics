import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validatePromoCode } from "@/lib/promo-codes/validate"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { code, rateType, subtotalCents, hours } = await req.json()

  const result = await validatePromoCode(supabase, {
    code,
    rateType,
    subtotalCents,
    hours,
  })

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error })
  }

  return NextResponse.json({
    valid: true,
    discount: result.discount,
  })
}

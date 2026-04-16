import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Check admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { bookingId, paymentId } = await req.json()

  // Update payment
  await supabase
    .from("payments")
    .update({
      status: "completed",
      manual_confirmed_by: user.id,
      manual_confirmed_at: new Date().toISOString(),
    })
    .eq("id", paymentId)

  // Update booking
  await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      payment_status: "paid",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", bookingId)

  return NextResponse.json({ message: "Payment confirmed" })
}

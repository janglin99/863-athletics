import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateAccessCodes } from "@/lib/access-codes/generate"

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

  // Match the other confirmation paths: now that the booking is paid +
  // confirmed, schedule access-code generation + email delivery after the
  // response is sent. generateAccessCodes is idempotent, so it's safe even
  // if the booking somehow already has codes.
  after(() => generateAccessCodes(bookingId))

  return NextResponse.json({ message: "Payment confirmed" })
}

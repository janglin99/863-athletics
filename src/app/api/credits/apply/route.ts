import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { bookingId, creditId } = body

  if (!bookingId || !creditId)
    return NextResponse.json(
      { error: "bookingId and creditId are required" },
      { status: 400 }
    )

  // Get the credit
  const { data: credit, error: creditError } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", creditId)
    .eq("customer_id", user.id)
    .gt("remaining_amount", 0)
    .single()

  if (creditError || !credit)
    return NextResponse.json(
      { error: "Credit not found or unavailable" },
      { status: 404 }
    )

  // Check expiry
  if (credit.expires_at && new Date(credit.expires_at) < new Date()) {
    return NextResponse.json({ error: "Credit has expired" }, { status: 400 })
  }

  // Get the booking with slots
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*, slots:booking_slots(*)")
    .eq("id", bookingId)
    .eq("customer_id", user.id)
    .single()

  if (bookingError || !booking)
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    )

  let amountApplied = 0
  let newRemaining = Number(credit.remaining_amount)
  const bookingTotalDollars = booking.total_cents / 100

  if (credit.credit_type === "dollar") {
    // Deduct the lesser of credit balance or booking total (in dollars)
    amountApplied = Math.min(Number(credit.remaining_amount), bookingTotalDollars)
    newRemaining = Number(credit.remaining_amount) - amountApplied
  } else if (credit.credit_type === "hours") {
    // Calculate booking hours from slots
    const totalMs = (booking.slots || []).reduce(
      (ms: number, s: { start_time: string; end_time: string }) =>
        ms + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()),
      0
    )
    const bookingHours = totalMs / (1000 * 60 * 60)
    amountApplied = Math.min(Number(credit.remaining_amount), bookingHours)
    newRemaining = Number(credit.remaining_amount) - amountApplied
  } else if (credit.credit_type === "sessions") {
    // 1 session covers 1 booking
    if (Number(credit.remaining_amount) >= 1) {
      amountApplied = 1
      newRemaining = Number(credit.remaining_amount) - 1
    } else {
      return NextResponse.json(
        { error: "Not enough session credits" },
        { status: 400 }
      )
    }
  }

  // Update the credit's remaining amount
  const { error: updateCreditError } = await supabase
    .from("user_credits")
    .update({
      remaining_amount: newRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", creditId)

  if (updateCreditError)
    return NextResponse.json(
      { error: updateCreditError.message },
      { status: 500 }
    )

  // Create use transaction
  await supabase.from("credit_transactions").insert({
    credit_id: creditId,
    booking_id: bookingId,
    amount: -amountApplied,
    type: "use",
    notes: `Applied ${credit.credit_type} credit to booking`,
  })

  // Calculate discount in cents for the booking
  let discountCents = 0
  let fullyCovered = false

  if (credit.credit_type === "dollar") {
    discountCents = Math.round(amountApplied * 100)
    fullyCovered = discountCents >= booking.total_cents
  } else if (credit.credit_type === "hours") {
    // If hours cover the booking, it's fully covered
    const totalMs = (booking.slots || []).reduce(
      (ms: number, s: { start_time: string; end_time: string }) =>
        ms + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()),
      0
    )
    const bookingHours = totalMs / (1000 * 60 * 60)
    fullyCovered = amountApplied >= bookingHours
    if (fullyCovered) {
      discountCents = booking.total_cents
    }
  } else if (credit.credit_type === "sessions") {
    // 1 session = fully covered
    fullyCovered = true
    discountCents = booking.total_cents
  }

  // Update booking
  const bookingUpdate: Record<string, unknown> = {
    discount_cents: (booking.discount_cents || 0) + discountCents,
  }

  if (fullyCovered) {
    bookingUpdate.payment_status = "paid"
    bookingUpdate.status = "confirmed"
    bookingUpdate.payment_method = "credit"
    bookingUpdate.confirmed_at = new Date().toISOString()
  }

  await supabase.from("bookings").update(bookingUpdate).eq("id", bookingId)

  return NextResponse.json({
    amountApplied,
    discountCents,
    fullyCovered,
    creditType: credit.credit_type,
    remainingCredit: newRemaining,
  })
}

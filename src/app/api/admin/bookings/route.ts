import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/resend/client"
import { sendSMS } from "@/lib/twilio/client"
import { generateAccessCodes } from "@/lib/access-codes/generate"
import { z } from "zod"

const PAYMENT_METHODS = [
  "stripe_card",
  "stripe_apple_pay",
  "stripe_google_pay",
  "zelle",
  "cash_app",
  "cash",
  "other",
] as const

const createSchema = z.object({
  customerId: z.string().uuid(),
  rateId: z.string().uuid(),
  trainerId: z.string().uuid().optional(),
  slots: z
    .array(
      z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      })
    )
    .min(1)
    .max(20),
  participantCount: z.number().int().min(1).max(30).default(1),
  notes: z.string().max(500).optional(),
  internalNotes: z.string().max(500).optional(),
  // If set (in cents), overrides the calculated total. 0 means free/comp.
  overrideTotalCents: z.number().int().min(0).max(10_000_00).optional(),
  paymentAction: z.enum(["mark_paid", "comp", "send_request"]),
  // Required when paymentAction === "mark_paid"
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notify: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!adminProfile || !["admin", "staff"].includes(adminProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }
  const data = parsed.data

  if (data.paymentAction === "mark_paid" && !data.paymentMethod) {
    return NextResponse.json(
      { error: "paymentMethod is required when marking paid" },
      { status: 400 }
    )
  }

  const { data: rate } = await supabase
    .from("rates")
    .select("*")
    .eq("id", data.rateId)
    .single()
  if (!rate)
    return NextResponse.json({ error: "Rate not found" }, { status: 404 })

  const { data: customer } = await supabase
    .from("profiles")
    .select("id, email, phone, first_name, notification_email, notification_sms")
    .eq("id", data.customerId)
    .single()
  if (!customer)
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })

  // Calculate total
  const totalMs = data.slots.reduce(
    (ms, s) => ms + (new Date(s.end).getTime() - new Date(s.start).getTime()),
    0
  )
  const totalHours = totalMs / (1000 * 60 * 60)
  let calculatedCents = rate.price_cents
  if (rate.per_unit === "hour") {
    calculatedCents = Math.round(rate.price_cents * totalHours)
  } else if (rate.per_unit === "person") {
    calculatedCents = Math.round(
      rate.price_cents * data.participantCount * totalHours
    )
  }
  const totalCents =
    data.overrideTotalCents !== undefined
      ? data.overrideTotalCents
      : calculatedCents

  // Build booking row based on payment action
  const isMarkPaid = data.paymentAction === "mark_paid"
  const isComp = data.paymentAction === "comp"
  const isSendRequest = data.paymentAction === "send_request"

  const bookingInsert: Record<string, unknown> = {
    customer_id: data.customerId,
    trainer_id: data.trainerId || null,
    rate_id: data.rateId,
    subtotal_cents: totalCents,
    total_cents: totalCents,
    discount_cents:
      data.overrideTotalCents !== undefined && data.overrideTotalCents < calculatedCents
        ? calculatedCents - data.overrideTotalCents
        : 0,
    participant_count: data.participantCount,
    notes: data.notes,
    internal_notes: [
      `Created by admin ${user.id}`,
      isComp ? "Comped session — no payment required" : null,
      data.overrideTotalCents !== undefined
        ? `Fee overridden (calculated $${(calculatedCents / 100).toFixed(2)} → $${(totalCents / 100).toFixed(2)})`
        : null,
      data.internalNotes,
    ]
      .filter(Boolean)
      .join(" | "),
    waiver_confirmed: true,
  }

  if (isMarkPaid) {
    bookingInsert.status = "confirmed"
    bookingInsert.payment_status = "paid"
    bookingInsert.payment_method = data.paymentMethod
    bookingInsert.confirmed_at = new Date().toISOString()
  } else if (isComp) {
    bookingInsert.status = "confirmed"
    bookingInsert.payment_status = "paid"
    bookingInsert.payment_method = "other"
    bookingInsert.confirmed_at = new Date().toISOString()
  } else {
    // send_request
    bookingInsert.status = "pending_payment"
    bookingInsert.payment_status = "pending_manual"
    bookingInsert.payment_method = null
  }

  // Admin is creating on behalf of someone else — service-role client
  // bypasses the bookings_insert_own RLS policy (customer_id = auth.uid()).
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .insert(bookingInsert)
    .select()
    .single()

  if (bookingError || !booking) {
    return NextResponse.json(
      { error: bookingError?.message || "Failed to create booking" },
      { status: 500 }
    )
  }

  // Slots
  const slotsData = data.slots.map((s) => ({
    booking_id: booking.id,
    start_time: s.start,
    end_time: s.end,
    status: "scheduled",
  }))
  const { error: slotsError } = await supabaseAdmin
    .from("booking_slots")
    .insert(slotsData)

  if (slotsError) {
    await supabaseAdmin.from("bookings").delete().eq("id", booking.id)
    return NextResponse.json(
      { error: "Failed to create time slots — they may be taken" },
      { status: 409 }
    )
  }

  // Record payment row for paid/comp so reports tie out
  if ((isMarkPaid || isComp) && totalCents > 0) {
    await supabaseAdmin.from("payments").insert({
      booking_id: booking.id,
      customer_id: data.customerId,
      amount_cents: totalCents,
      method: isComp ? "other" : data.paymentMethod,
      status: "completed",
      manual_confirmed_by: user.id,
      manual_confirmed_at: new Date().toISOString(),
      notes: isComp ? "Admin-comped session" : "Admin-recorded payment",
    })
  }

  // mark_paid and comp bookings are confirmed immediately, so generate +
  // deliver the Seam access codes after the response is sent. send_request
  // bookings stay pending; the Stripe webhook / manual-confirm flow handles
  // codes once the customer actually pays.
  if (isMarkPaid || isComp) {
    after(() => generateAccessCodes(booking.id))
  }

  // Notifications
  if (data.notify) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://863athletics.com"
    const bookingUrl = `${baseUrl}/bookings/${booking.id}`
    const firstSlot = [...slotsData].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )[0]
    const sessionDate = new Date(firstSlot.start_time).toLocaleString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

    const notifications: Array<{
      channel: "email" | "sms"
      type: string
      recipient: string
      subject?: string
      preview: string
    }> = []

    if (isSendRequest) {
      const amount = `$${(totalCents / 100).toFixed(2)}`
      const text = `Hi ${customer.first_name}, an admin scheduled a session for you at 863 Athletics on ${sessionDate}. Total: ${amount}. Pay here: ${bookingUrl}`
      const subject = `Action required: Pay for your session at 863 Athletics`

      if (customer.notification_email && customer.email) {
        try {
          await sendEmail({ to: customer.email, subject, text })
          notifications.push({
            channel: "email",
            type: "payment_pending_manual",
            recipient: customer.email,
            subject,
            preview: text.slice(0, 140),
          })
        } catch {
          // best-effort
        }
      }
      if (customer.notification_sms && customer.phone) {
        try {
          await sendSMS(customer.phone, text)
          notifications.push({
            channel: "sms",
            type: "payment_pending_manual",
            recipient: customer.phone,
            preview: text.slice(0, 140),
          })
        } catch {
          // best-effort
        }
      }
    } else {
      // mark_paid or comp — confirmation
      const text = isComp
        ? `Hi ${customer.first_name}, you have a complimentary session at 863 Athletics on ${sessionDate}. Details: ${bookingUrl}`
        : `Hi ${customer.first_name}, your session at 863 Athletics on ${sessionDate} is confirmed. Details: ${bookingUrl}`
      const subject = isComp
        ? `You have a comped session at 863 Athletics`
        : `Your session at 863 Athletics is confirmed`

      if (customer.notification_email && customer.email) {
        try {
          await sendEmail({ to: customer.email, subject, text })
          notifications.push({
            channel: "email",
            type: "booking_confirmed",
            recipient: customer.email,
            subject,
            preview: text.slice(0, 140),
          })
        } catch {
          // best-effort
        }
      }
      if (customer.notification_sms && customer.phone) {
        try {
          await sendSMS(customer.phone, text)
          notifications.push({
            channel: "sms",
            type: "booking_confirmed",
            recipient: customer.phone,
            preview: text.slice(0, 140),
          })
        } catch {
          // best-effort
        }
      }
    }

    if (notifications.length > 0) {
      const now = new Date().toISOString()
      await supabaseAdmin.from("notification_log").insert(
        notifications.map((n) => ({
          customer_id: data.customerId,
          booking_id: booking.id,
          type: n.type,
          channel: n.channel,
          recipient: n.recipient,
          subject: n.subject,
          preview: n.preview,
          status: "sent",
          sent_at: now,
        }))
      )
    }
  }

  return NextResponse.json(
    { booking: { ...booking, slots: slotsData }, message: "Booking created" },
    { status: 201 }
  )
}

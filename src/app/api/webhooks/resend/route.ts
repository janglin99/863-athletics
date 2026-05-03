import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { supabaseAdmin } from "@/lib/supabase/admin"

// Resend signs webhooks via Svix. Configure the secret in Resend's dashboard
// under Webhooks; copy the signing secret into RESEND_WEBHOOK_SECRET.
//
// Event types we care about:
//   email.delivered   — provider says it landed
//   email.bounced     — hard or soft bounce
//   email.complained  — recipient marked spam
// We also handle email.delivery_delayed and email.sent passively.
//
// We update the notification_log row whose provider_id matches the event's
// email_id. If no row matches (e.g., the email was sent before this tracker
// was wired up), we silently no-op.

interface ResendEvent {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    bounce?: { message?: string; type?: string }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET not configured" },
      { status: 500 }
    )
  }

  const body = await req.text()
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  }

  let event: ResendEvent
  try {
    event = new Webhook(secret).verify(body, headers) as ResendEvent
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const messageId = event.data?.email_id
  if (!messageId) {
    return NextResponse.json({ ok: true })
  }

  const at = event.created_at ?? new Date().toISOString()
  const updates: Record<string, unknown> = {}

  switch (event.type) {
    case "email.delivered":
      updates.status = "delivered"
      updates.delivered_at = at
      break
    case "email.bounced":
      updates.status = "bounced"
      updates.bounced_at = at
      updates.bounce_reason =
        event.data?.bounce?.message ?? event.data?.bounce?.type ?? null
      break
    case "email.complained":
      updates.status = "complained"
      updates.complained_at = at
      break
    default:
      // sent / delivery_delayed / opened / clicked — ignore
      return NextResponse.json({ ok: true })
  }

  const { error } = await supabaseAdmin
    .from("notification_log")
    .update(updates)
    .eq("provider_id", messageId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

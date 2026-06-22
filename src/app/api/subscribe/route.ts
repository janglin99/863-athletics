import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const { email, phone, smsConsent } = await req.json()

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null

  const { error } = await supabaseAdmin.from("subscribers").upsert(
    {
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      sms_consent: smsConsent === true,
      consented_at: smsConsent === true ? new Date().toISOString() : null,
      ip_address: ip,
    },
    { onConflict: "email" }
  )

  if (error) {
    console.error("[subscribe]", error)
    return NextResponse.json({ error: "Could not save subscription." }, { status: 500 })
  }

  // If user already has a profile, keep their notification_sms in sync
  if (smsConsent && phone) {
    await supabaseAdmin
      .from("profiles")
      .update({ notification_sms: true, phone: phone.trim() })
      .eq("email", email.toLowerCase().trim())
  }

  return NextResponse.json({ ok: true })
}

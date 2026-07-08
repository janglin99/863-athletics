import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Marks all of the caller's own newly-published, not-yet-viewed invoices as
// viewed (dismisses the "new invoice" dashboard notice). Scoped server-side
// via a SECURITY DEFINER function so the caller can only ever touch
// viewed_at on their own rows — see supabase/migrations/017.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase.rpc("mark_customer_invoices_viewed")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

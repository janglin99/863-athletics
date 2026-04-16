import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    { count: totalCustomers },
    { data: todayBookings },
    { data: pendingPayments },
    { data: todayRevenue },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer"),
    supabase
      .from("booking_slots")
      .select("*, booking:bookings!inner(*, customer:profiles!customer_id(*), rate:rates(*))")
      .gte("start_time", today.toISOString())
      .lt("start_time", tomorrow.toISOString())
      .neq("status", "cancelled"),
    supabase
      .from("bookings")
      .select("*, customer:profiles!customer_id(*)")
      .eq("payment_status", "pending_manual"),
    supabase
      .from("payments")
      .select("amount_cents")
      .eq("status", "completed")
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString()),
  ])

  const todayRevenueCents =
    todayRevenue?.reduce((sum, p) => sum + p.amount_cents, 0) || 0

  return NextResponse.json({
    totalCustomers: totalCustomers || 0,
    todayBookings: todayBookings || [],
    todayBookingCount: todayBookings?.length || 0,
    pendingPayments: pendingPayments || [],
    pendingPaymentCount: pendingPayments?.length || 0,
    todayRevenueCents,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
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

  if (!profile)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const isAdmin = ["admin", "staff"].includes(profile.role)
  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get("customerId")

  let query = supabase
    .from("user_credits")
    .select("*")
    .gt("remaining_amount", 0)
    .or("expires_at.is.null,expires_at.gt.now()")

  if (isAdmin && customerId) {
    query = query.eq("customer_id", customerId)
  } else if (!isAdmin) {
    query = query.eq("customer_id", user.id)
  } else {
    // Admin without customerId — return empty (must specify customer)
    return NextResponse.json({ credits: [] })
  }

  query = query.order("created_at", { ascending: false })

  const { data: credits, error } = await query

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ credits: credits || [] })
}

export async function POST(req: NextRequest) {
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

  if (!profile || !["admin", "staff"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { customerId, creditType, amount, description, expiresAt } = body

  if (!customerId || !creditType || !amount) {
    return NextResponse.json(
      { error: "customerId, creditType, and amount are required" },
      { status: 400 }
    )
  }

  // Create credit
  const { data: credit, error: creditError } = await supabase
    .from("user_credits")
    .insert({
      customer_id: customerId,
      credit_type: creditType,
      original_amount: amount,
      remaining_amount: amount,
      description: description || null,
      expires_at: expiresAt || null,
      granted_by: user.id,
    })
    .select()
    .single()

  if (creditError)
    return NextResponse.json({ error: creditError.message }, { status: 500 })

  // Create grant transaction
  await supabase.from("credit_transactions").insert({
    credit_id: credit.id,
    amount,
    type: "grant",
    notes: description || "Credit granted",
  })

  return NextResponse.json({ credit })
}

export async function PATCH(req: NextRequest) {
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

  if (!profile || !["admin", "staff"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { creditId, newAmount, notes } = body

  if (!creditId || newAmount == null) {
    return NextResponse.json(
      { error: "creditId and newAmount are required" },
      { status: 400 }
    )
  }

  // Get current credit
  const { data: current } = await supabase
    .from("user_credits")
    .select("remaining_amount")
    .eq("id", creditId)
    .single()

  if (!current)
    return NextResponse.json({ error: "Credit not found" }, { status: 404 })

  const diff = newAmount - Number(current.remaining_amount)

  // Update credit
  const { data: credit, error } = await supabase
    .from("user_credits")
    .update({ remaining_amount: newAmount, updated_at: new Date().toISOString() })
    .eq("id", creditId)
    .select()
    .single()

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  // Create adjust transaction
  await supabase.from("credit_transactions").insert({
    credit_id: creditId,
    amount: diff,
    type: "adjust",
    notes: notes || `Adjusted by ${diff >= 0 ? "+" : ""}${diff}`,
  })

  return NextResponse.json({ credit })
}

export async function DELETE(req: NextRequest) {
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

  if (!profile || !["admin", "staff"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { creditId } = body

  if (!creditId)
    return NextResponse.json({ error: "creditId is required" }, { status: 400 })

  const { error } = await supabase
    .from("user_credits")
    .delete()
    .eq("id", creditId)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: "Credit removed" })
}

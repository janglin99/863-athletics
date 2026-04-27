import type Anthropic from "@anthropic-ai/sdk"
import type { SupabaseClient } from "@supabase/supabase-js"

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_facility_info",
    description:
      "Returns 863 Athletics's contact info, address, and weekly operating hours. Use this whenever a customer asks about hours, location, phone, or how to contact the gym.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_profile",
    description:
      "Returns the signed-in customer's profile: name, email, phone, emergency contact, notification preferences, and waiver status. Use this whenever the customer asks about their own account info.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_credits",
    description:
      "Returns the signed-in customer's credit balances (dollar credits, hour credits, session credits). Use this when the customer asks about credit, store credit, hours remaining, or sessions remaining.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_bookings",
    description:
      "Returns the signed-in customer's bookings with their slots, rate, status, and payment status. Use the `filter` parameter to scope results.",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["upcoming", "past", "all"],
          description:
            "upcoming = future, non-cancelled bookings; past = bookings that already happened; all = both",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "Maximum bookings to return (default 10)",
        },
      },
      required: ["filter"],
    },
  },
  {
    name: "get_rates",
    description:
      "Returns the active rates 863 Athletics offers — name, price, per-unit (session/hour/etc), and advance-notice window. Use this whenever the customer asks about pricing, rates, packages, or what types of sessions are available.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_profile",
    description:
      "Update one or more low-risk profile fields for the signed-in customer: first/last name, phone, emergency contact, notification preferences. Cannot change email (use a separate flow), role, credits, waiver, or any financial fields. Pass only the fields you want to change — omit anything that should stay the same. Always summarize the change and get the customer's verbal confirmation BEFORE calling this tool.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "New first name" },
        last_name: { type: "string", description: "New last name" },
        phone: {
          type: "string",
          description:
            "New phone number (any format the customer types — store as-is)",
        },
        emergency_name: {
          type: "string",
          description: "Emergency contact's name",
        },
        emergency_phone: {
          type: "string",
          description: "Emergency contact's phone",
        },
        notification_email: {
          type: "boolean",
          description: "Receive booking confirmations and updates by email",
        },
        notification_sms: {
          type: "boolean",
          description: "Receive access codes and reminders by SMS",
        },
        notification_reminders: {
          type: "boolean",
          description: "Receive 24h and 1h pre-session reminders",
        },
      },
    },
  },
  {
    name: "get_availability_summary",
    description:
      "Returns a per-day summary of available slots over a date range, optionally for a specific rate. Each entry contains the date, weekday, total slot count, and available slot count. Use this to answer 'do you have anything open on X' or 'when's the next opening'.",
    input_schema: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD) inclusive. Defaults to today.",
        },
        endDate: {
          type: "string",
          description:
            "End date (YYYY-MM-DD) inclusive. Defaults to 14 days from start.",
        },
        rateId: {
          type: "string",
          description:
            "Optional rate UUID. Pass when filtering by a specific rate (look it up first via get_rates).",
        },
      },
    },
  },
]

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { userId: string; supabase: SupabaseClient }
): Promise<string> {
  const { userId, supabase } = ctx

  switch (name) {
    case "get_facility_info": {
      const { data: hours } = await supabase
        .from("facility_hours")
        .select("*")
        .order("day_of_week")
      const formatted = (hours ?? []).map((h) => ({
        day: DAY_NAMES[h.day_of_week],
        is_open: h.is_open,
        open_time: h.is_open ? h.open_time : null,
        close_time: h.is_open ? h.close_time : null,
      }))
      return JSON.stringify({
        name: "863 Athletics",
        website: "https://863athletics.com",
        weekly_hours: formatted,
      })
    }

    case "get_my_profile": {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "first_name, last_name, email, phone, emergency_name, emergency_phone, notification_email, notification_sms, notification_reminders, waiver_signed"
        )
        .eq("id", userId)
        .single()
      if (error || !data) {
        return JSON.stringify({ error: "Profile not found" })
      }
      return JSON.stringify(data)
    }

    case "get_my_credits": {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "credit_dollar_cents, credit_hours, credit_sessions"
        )
        .eq("id", userId)
        .single()
      if (error || !data) {
        return JSON.stringify({ error: "Could not retrieve credit balances" })
      }
      return JSON.stringify({
        dollar_credit: fmtCents(data.credit_dollar_cents ?? 0),
        dollar_credit_cents: data.credit_dollar_cents ?? 0,
        hour_credits: data.credit_hours ?? 0,
        session_credits: data.credit_sessions ?? 0,
      })
    }

    case "get_my_bookings": {
      const filter = (input.filter as string) || "upcoming"
      const limit = Math.min(Number(input.limit ?? 10), 20)
      const nowIso = new Date().toISOString()

      let query = supabase
        .from("bookings")
        .select(
          "id, booking_number, status, payment_status, total_cents, participant_count, is_recurring, rate:rates(name, per_unit), slots:booking_slots(start_time, end_time, status)"
        )
        .eq("customer_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (filter === "upcoming") {
        query = query.neq("status", "cancelled")
      }

      const { data, error } = await query
      if (error) return JSON.stringify({ error: error.message })

      const shaped = (data ?? [])
        .map((b) => {
          const activeSlots = (b.slots ?? [])
            .filter((s: { status: string }) => s.status !== "cancelled")
            .sort((a: { start_time: string }, c: { start_time: string }) =>
              a.start_time.localeCompare(c.start_time)
            )
          const firstStart = activeSlots[0]?.start_time
          const lastEnd = activeSlots[activeSlots.length - 1]?.end_time
          return {
            id: b.id,
            detail_url: `/bookings/${b.id}`,
            booking_number: b.booking_number,
            status: b.status,
            payment_status: b.payment_status,
            rate: b.rate,
            total: fmtCents(b.total_cents),
            participants: b.participant_count,
            is_recurring: b.is_recurring,
            session_start: firstStart ?? null,
            session_end: lastEnd ?? null,
          }
        })
        .filter((b) => {
          if (filter === "upcoming") {
            return b.session_start && b.session_start >= nowIso
          }
          if (filter === "past") {
            return b.session_start && b.session_start < nowIso
          }
          return true
        })

      return JSON.stringify({ count: shaped.length, bookings: shaped })
    }

    case "get_rates": {
      const { data, error } = await supabase
        .from("rates")
        .select(
          "id, name, description, type, price_cents, per_unit, min_hours, max_hours, min_people, max_people, advance_notice_hours, cancellation_hours"
        )
        .eq("is_active", true)
        .neq("type", "staff_access")
        .order("sort_order")
      if (error) return JSON.stringify({ error: error.message })
      const shaped = (data ?? []).map((r) => ({
        ...r,
        price: fmtCents(r.price_cents),
      }))
      return JSON.stringify({ count: shaped.length, rates: shaped })
    }

    case "get_availability_summary": {
      const today = new Date()
      const startStr =
        (input.startDate as string) || today.toISOString().slice(0, 10)
      const endDefault = new Date(today.getTime() + 14 * 86400000)
      const endStr =
        (input.endDate as string) || endDefault.toISOString().slice(0, 10)
      const rateId = input.rateId as string | undefined

      const start = new Date(`${startStr}T00:00:00.000Z`).toISOString()
      const end = new Date(`${endStr}T23:59:59.999Z`).toISOString()

      const params = new URLSearchParams({ start, end })
      if (rateId) params.set("rateId", rateId)
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://863athletics.com"
      const res = await fetch(`${baseUrl}/api/availability?${params.toString()}`)
      if (!res.ok) {
        return JSON.stringify({ error: "Could not load availability" })
      }
      const json = (await res.json()) as {
        availability: Record<
          string,
          {
            date: string
            slots: Array<{ start: string; end: string; available: boolean }>
          }
        >
        cutoff?: string
      }
      const summary = Object.values(json.availability).map((day) => ({
        date: day.date,
        weekday: DAY_NAMES[new Date(`${day.date}T12:00:00`).getUTCDay()],
        total_slots: day.slots.length,
        available_slots: day.slots.filter((s) => s.available).length,
      }))
      return JSON.stringify({
        cutoff: json.cutoff ?? null,
        days: summary,
      })
    }

    case "update_profile": {
      const allowed = [
        "first_name",
        "last_name",
        "phone",
        "emergency_name",
        "emergency_phone",
        "notification_email",
        "notification_sms",
        "notification_reminders",
      ] as const

      const updates: Record<string, unknown> = {}
      for (const field of allowed) {
        if (input[field] !== undefined && input[field] !== null) {
          updates[field] = input[field]
        }
      }

      if (Object.keys(updates).length === 0) {
        return JSON.stringify({
          error: "No updatable fields were provided",
        })
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)

      if (error) {
        return JSON.stringify({ error: error.message })
      }

      return JSON.stringify({
        success: true,
        updated_fields: Object.keys(updates),
        new_values: updates,
      })
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

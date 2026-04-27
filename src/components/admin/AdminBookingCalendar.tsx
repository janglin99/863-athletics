"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { fromZonedTime } from "date-fns-tz"
import { addDays, startOfWeek, format } from "date-fns"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AdminBookingDetailDialog } from "@/components/admin/AdminBookingDetailDialog"
import { AdminCreateBookingDialog } from "@/components/admin/AdminCreateBookingDialog"

const FACILITY_TZ = "America/New_York"
const DAY_START_MIN = 6 * 60 // 06:00
const DAY_END_MIN = 22 * 60 // 22:00
const ROW_HEIGHT_PX = 36 // per 30-min slot
const ROWS = (DAY_END_MIN - DAY_START_MIN) / 30
const GRID_HEIGHT = ROWS * ROW_HEIGHT_PX

interface SlotRow {
  id: string
  booking_id: string
  start_time: string
  end_time: string
  status: string
  booking: {
    id: string
    booking_number: string
    status: string
    payment_status: string
    customer: {
      first_name: string
      last_name: string
    } | null
    rate: {
      name: string
      color_hex: string | null
    } | null
  } | null
}

interface Pill {
  slotId: string
  bookingId: string
  startMin: number
  endMin: number
  customerName: string
  startLabel: string
  endLabel: string
  color: string
  bookingStatus: string
  paymentStatus: string
  col: number
  totalCols: number
}

// Convert an ISO string to ET-anchored {dateKey, minutesFromMidnight}
function isoToET(iso: string) {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FACILITY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0"
  const hour = parseInt(get("hour") === "24" ? "0" : get("hour"))
  const minute = parseInt(get("minute"))
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
  }
}

function formatHourLabel(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const ampm = h >= 12 ? "PM" : "AM"
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${display} ${ampm}` : `${display}:${String(m).padStart(2, "0")} ${ampm}`
}

function statusOpacity(status: string) {
  if (status === "cancelled") return 0.3
  if (status === "pending_payment") return 0.65
  return 1
}

export function AdminBookingCalendar() {
  // Current week start (Sunday). startOfWeek default is Sunday for en-US.
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  )
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>()
  const [createInitialSlots, setCreateInitialSlots] = useState<
    { start: string; end: string }[] | undefined
  >()

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])

  // Fetch slots for the visible week
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from("booking_slots")
        .select(
          "id, booking_id, start_time, end_time, status, booking:bookings!inner(id, booking_number, status, payment_status, customer:profiles!customer_id(first_name, last_name), rate:rates(name, color_hex))"
        )
        .gte("start_time", weekStart.toISOString())
        .lt("start_time", weekEnd.toISOString())
        .order("start_time", { ascending: true })
      if (cancelled) return
      setSlots((data as unknown as SlotRow[]) || [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [weekStart, weekEnd, refreshKey])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Build day key list for the visible week
  const dayKeys = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      return {
        date: d,
        key: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE"),
        dayLabel: format(d, "MMM d"),
      }
    })
  }, [weekStart])

  // Group pills by day with overlap layout
  const pillsByDay = useMemo<Record<string, Pill[]>>(() => {
    const byDay: Record<string, Pill[]> = {}

    // First, build raw pills per ET date
    for (const s of slots) {
      if (s.status === "cancelled") continue
      const startET = isoToET(s.start_time)
      const endET = isoToET(s.end_time)
      // If slot spans midnight, clamp end to 24:00 for display purposes
      const endMin =
        endET.dateKey === startET.dateKey ? endET.minutes : 24 * 60
      const dayKey = startET.dateKey

      const customer = s.booking?.customer
      const customerName = customer
        ? `${customer.first_name} ${customer.last_name}`
        : "Guest"

      const startLabel = formatHourLabel(startET.minutes)
      const endLabel = formatHourLabel(endMin)

      const pill: Pill = {
        slotId: s.id,
        bookingId: s.booking_id,
        startMin: Math.max(startET.minutes, DAY_START_MIN),
        endMin: Math.min(endMin, DAY_END_MIN),
        customerName,
        startLabel,
        endLabel,
        color: s.booking?.rate?.color_hex || "#FF4700",
        bookingStatus: s.booking?.status || "confirmed",
        paymentStatus: s.booking?.payment_status || "unpaid",
        col: 0,
        totalCols: 1,
      }
      // Skip pills entirely outside visible window
      if (pill.endMin <= DAY_START_MIN || pill.startMin >= DAY_END_MIN) continue
      ;(byDay[dayKey] ??= []).push(pill)
    }

    // Compute overlap groups + columns per day
    for (const key of Object.keys(byDay)) {
      const list = byDay[key]
      list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

      let group: Pill[] = []
      let groupMaxEnd = -Infinity
      const groups: Pill[][] = []
      for (const p of list) {
        if (group.length > 0 && groupMaxEnd > p.startMin) {
          group.push(p)
          groupMaxEnd = Math.max(groupMaxEnd, p.endMin)
        } else {
          group = [p]
          groupMaxEnd = p.endMin
          groups.push(group)
        }
      }
      for (const g of groups) {
        // greedy column assignment
        const colEnds: number[] = []
        for (const p of g) {
          let col = colEnds.findIndex((e) => e <= p.startMin)
          if (col === -1) {
            col = colEnds.length
            colEnds.push(p.endMin)
          } else {
            colEnds[col] = p.endMin
          }
          p.col = col
        }
        const totalCols = colEnds.length
        for (const p of g) p.totalCols = totalCols
      }
    }

    return byDay
  }, [slots])

  const navigate = (deltaDays: number) =>
    setWeekStart((prev) => addDays(prev, deltaDays))

  const goToToday = () =>
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))

  const handleCellClick = (day: Date, slotIdx: number) => {
    const minutes = DAY_START_MIN + slotIdx * 30
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0")
    const mm = String(minutes % 60).padStart(2, "0")
    const dayKey = format(day, "yyyy-MM-dd")
    // Build start/end as 1-hour selection in ET → UTC ISO
    const startUtc = fromZonedTime(`${dayKey} ${hh}:${mm}:00`, FACILITY_TZ)
    const endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000)
    // Two 30-min slots so it satisfies the booking flow's 1-hour minimum
    const mid = new Date(startUtc.getTime() + 30 * 60 * 1000)
    setCreateInitialDate(day)
    setCreateInitialSlots([
      { start: startUtc.toISOString(), end: mid.toISOString() },
      { start: mid.toISOString(), end: endUtc.toISOString() },
    ])
    setCreateOpen(true)
  }

  const handlePillClick = (bookingId: string) => {
    setDetailBookingId(bookingId)
    setDetailOpen(true)
  }

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`

  // Build hour ticks
  const hourTicks = useMemo(() => {
    const ticks: { min: number; label: string }[] = []
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += 60) {
      ticks.push({ min: m, label: formatHourLabel(m) })
    }
    return ticks
  }, [])

  return (
    <div className="border border-border rounded-lg bg-bg-secondary overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-7)}
            className="border-border"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="border-border"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(7)}
            className="border-border"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-3 font-display font-bold tracking-wide text-text-primary">
            {weekLabel}
          </span>
        </div>
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
        )}
      </div>

      {/* Day headers */}
      <div
        className="grid border-b border-border bg-bg-elevated text-xs"
        style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
      >
        <div />
        {dayKeys.map((d) => {
          const isToday =
            format(d.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
          return (
            <div
              key={d.key}
              className={cn(
                "p-2 text-center border-l border-border",
                isToday ? "text-brand-orange" : "text-text-secondary"
              )}
            >
              <div className="font-bold uppercase">{d.label}</div>
              <div className={cn("text-xs", isToday && "text-brand-orange")}>
                {d.dayLabel}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid body */}
      <div
        className="grid relative overflow-x-auto"
        style={{
          gridTemplateColumns: "60px repeat(7, minmax(120px, 1fr))",
          height: GRID_HEIGHT,
        }}
      >
        {/* Time column */}
        <div className="relative border-r border-border">
          {hourTicks.map((t) => (
            <div
              key={t.min}
              className="absolute right-2 -translate-y-1/2 text-[10px] text-text-muted"
              style={{
                top: ((t.min - DAY_START_MIN) / 30) * ROW_HEIGHT_PX,
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dayKeys.map((d) => {
          const pills = pillsByDay[d.key] || []
          return (
            <div
              key={d.key}
              className="relative border-l border-border"
            >
              {/* Click-to-add cells */}
              {Array.from({ length: ROWS }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCellClick(d.date, idx)}
                  className={cn(
                    "absolute left-0 right-0 border-b border-border/40 hover:bg-brand-orange/5 transition-colors",
                    idx % 2 === 0 ? "border-border/60" : "border-transparent"
                  )}
                  style={{
                    top: idx * ROW_HEIGHT_PX,
                    height: ROW_HEIGHT_PX,
                  }}
                />
              ))}

              {/* Pills */}
              {pills.map((p) => {
                const top =
                  ((p.startMin - DAY_START_MIN) / 30) * ROW_HEIGHT_PX
                const height = Math.max(
                  ((p.endMin - p.startMin) / 30) * ROW_HEIGHT_PX - 2,
                  18
                )
                const widthPct = 100 / p.totalCols
                const leftPct = p.col * widthPct
                const isPending = p.paymentStatus === "pending_manual"
                return (
                  <button
                    key={p.slotId}
                    type="button"
                    onClick={() => handlePillClick(p.bookingId)}
                    className={cn(
                      "absolute rounded-md text-left p-1.5 text-[11px] leading-tight overflow-hidden hover:ring-2 hover:ring-white/40 transition-all",
                      isPending && "border-2 border-dashed"
                    )}
                    style={{
                      top,
                      height,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      backgroundColor: p.color,
                      opacity: statusOpacity(p.bookingStatus),
                      borderColor: isPending ? "rgba(255,255,255,0.6)" : "transparent",
                      color: "white",
                    }}
                    title={`${p.customerName} · ${p.startLabel} – ${p.endLabel}`}
                  >
                    <div className="font-mono text-[10px] opacity-90">
                      {p.startLabel} – {p.endLabel}
                    </div>
                    <div className="font-semibold truncate">
                      {p.customerName}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Detail dialog */}
      <AdminBookingDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        bookingId={detailBookingId}
        onChanged={refresh}
      />

      {/* Create dialog (controlled, no trigger) */}
      <AdminCreateBookingDialog
        hideTrigger
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDate={createInitialDate}
        initialSlots={createInitialSlots}
        onCreated={refresh}
      />
    </div>
  )
}

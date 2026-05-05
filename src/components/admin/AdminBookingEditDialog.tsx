"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import type { Booking, BookingStatus, PaymentStatus } from "@/types"

const BOOKING_STATUSES: BookingStatus[] = [
  "pending_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "refunded",
]

const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "pending_manual",
  "paid",
  "partially_refunded",
  "fully_refunded",
]

const FACILITY_TZ = "America/New_York"

// Format an ISO UTC timestamp as a "YYYY-MM-DDTHH:mm" string for a
// <input type="datetime-local"> in the facility's time zone.
function isoToFacilityLocal(iso: string): string {
  const d = new Date(iso)
  const parts = d.toLocaleString("sv-SE", {
    timeZone: FACILITY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  return parts.replace(" ", "T").slice(0, 16)
}

// Parse a "YYYY-MM-DDTHH:mm" datetime-local string interpreted as facility-time
// back into a UTC ISO string. Iterates twice to settle DST cleanly.
function facilityLocalToIso(local: string): string {
  const [date, time] = local.split("T")
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  let utc = wall
  for (let i = 0; i < 2; i++) {
    const offset = facilityOffsetMinutes(new Date(utc))
    utc = wall - offset * 60_000
  }
  return new Date(utc).toISOString()
}

function facilityOffsetMinutes(d: Date): number {
  const local = d.toLocaleString("en-US", { timeZone: FACILITY_TZ })
  const utc = d.toLocaleString("en-US", { timeZone: "UTC" })
  return (new Date(local).getTime() - new Date(utc).getTime()) / 60_000
}

interface SlotEdit {
  id: string
  start: string
  end: string
}

interface Props {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function AdminBookingEditDialog({
  booking,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [notes, setNotes] = useState(booking.notes ?? "")
  const [internalNotes, setInternalNotes] = useState(booking.internal_notes ?? "")
  const [totalDollars, setTotalDollars] = useState(
    (booking.total_cents / 100).toFixed(2)
  )
  const [status, setStatus] = useState<BookingStatus>(booking.status)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    booking.payment_status
  )
  const [slots, setSlots] = useState<SlotEdit[]>([])
  const [saving, setSaving] = useState(false)
  const [promoCode, setPromoCode] = useState("")

  useEffect(() => {
    if (!open) return
    setNotes(booking.notes ?? "")
    setInternalNotes(booking.internal_notes ?? "")
    setTotalDollars((booking.total_cents / 100).toFixed(2))
    setStatus(booking.status)
    setPaymentStatus(booking.payment_status)
    setSlots(
      (booking.slots ?? [])
        .filter((s) => s.status !== "cancelled")
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        .map((s) => ({
          id: s.id,
          start: isoToFacilityLocal(s.start_time),
          end: isoToFacilityLocal(s.end_time),
        }))
    )
    setPromoCode("")
  }, [open, booking])

  const handleSlotChange = (
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  const handleSave = async () => {
    const cents = Math.round(parseFloat(totalDollars) * 100)
    if (Number.isNaN(cents) || cents < 0) {
      toast.error("Total must be a non-negative number")
      return
    }

    for (const s of slots) {
      if (!s.start || !s.end) {
        toast.error("All slot times must be set")
        return
      }
      if (new Date(s.end) <= new Date(s.start)) {
        toast.error("Slot end must be after start")
        return
      }
    }

    setSaving(true)
    const trimmedPromo = promoCode.trim()
    const res = await fetch(`/api/admin/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes,
        internalNotes,
        // Skip totalCents if a promo is being applied — server recomputes
        // authoritatively from the rate × hours and the promo's discount.
        ...(trimmedPromo ? {} : { totalCents: cents }),
        status,
        paymentStatus,
        slots: slots.map((s) => ({
          id: s.id,
          start: facilityLocalToIso(s.start),
          end: facilityLocalToIso(s.end),
        })),
        ...(trimmedPromo ? { promoCode: trimmedPromo } : {}),
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Failed to save")
      return
    }

    toast.success("Booking updated")
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-secondary border-border max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide">
            Edit Booking {booking.booking_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Booking Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
                className="w-full h-10 rounded-md bg-bg-elevated border border-border px-3 text-sm"
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Payment Status</Label>
              <select
                value={paymentStatus}
                onChange={(e) =>
                  setPaymentStatus(e.target.value as PaymentStatus)
                }
                className="w-full h-10 rounded-md bg-bg-elevated border border-border px-3 text-sm"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Total ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={totalDollars}
              onChange={(e) => setTotalDollars(e.target.value)}
              className="bg-bg-elevated border-border"
              disabled={promoCode.trim().length > 0}
            />
            <p className="text-xs text-text-muted">
              {promoCode.trim()
                ? "Total will be recalculated from the promo code on save."
                : "Updates both subtotal and total. Doesn't adjust existing payment records."}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">
              Apply discount code{" "}
              <span className="text-text-muted">(optional)</span>
            </Label>
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="GLAM"
              className="bg-bg-elevated border-border font-mono uppercase"
              maxLength={64}
            />
            <p className="text-xs text-text-muted">
              Server re-validates and recomputes the booking total. Increments
              the code&apos;s usage count. Doesn&apos;t adjust existing payment
              records — handle any refund / credit separately.
            </p>
          </div>

          {slots.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">
                Time Slots ({FACILITY_TZ.replace("_", " ")})
              </Label>
              {slots.map((s, i) => (
                <div key={s.id} className="grid grid-cols-2 gap-2">
                  <Input
                    type="datetime-local"
                    value={s.start}
                    onChange={(e) =>
                      handleSlotChange(i, "start", e.target.value)
                    }
                    className="bg-bg-elevated border-border"
                  />
                  <Input
                    type="datetime-local"
                    value={s.end}
                    onChange={(e) => handleSlotChange(i, "end", e.target.value)}
                    className="bg-bg-elevated border-border"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Customer-visible notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-bg-elevated border-border text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Internal notes</Label>
            <Textarea
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="bg-bg-elevated border-border text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

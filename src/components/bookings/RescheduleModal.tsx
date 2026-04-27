"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { TimeSlotGrid } from "@/components/booking/TimeSlotGrid"
import {
  formatCents,
  formatDate,
  formatTimeRange,
} from "@/lib/utils/format"
import { toast } from "sonner"
import { RefreshCw, ArrowRight, AlertCircle } from "lucide-react"
import { format, startOfDay } from "date-fns"
import type { Booking, TimeSlot } from "@/types"

interface RescheduleModalProps {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
  onRescheduled: () => void
}

interface RescheduleFeeInfo {
  hoursRemaining: number
  fee: { name: string; fee_cents: number } | null
  canReschedule: boolean
  message?: string
}

export function RescheduleModal({
  booking,
  open,
  onOpenChange,
  onRescheduled,
}: RescheduleModalProps) {
  const [feeInfo, setFeeInfo] = useState<RescheduleFeeInfo | null>(null)
  const [loadingFee, setLoadingFee] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlots, setSelectedSlots] = useState<
    { start: string; end: string }[]
  >([])
  const [submitting, setSubmitting] = useState(false)
  const [cutoff, setCutoff] = useState<Date | null>(null)

  // Fetch fee info + cutoff when modal opens
  useEffect(() => {
    if (open) {
      setFeeInfo(null)
      setSelectedDate(undefined)
      setSlots([])
      setSelectedSlots([])
      setCutoff(null)
      fetchFeeInfo()
      fetchCutoff()
    }
  }, [open])

  // Fetch slots when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate)
    }
  }, [selectedDate])

  async function fetchFeeInfo() {
    setLoadingFee(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reschedule-fee`)
      const data = await res.json()
      setFeeInfo(data)
    } catch {
      toast.error("Failed to fetch reschedule fee info")
    }
    setLoadingFee(false)
  }

  async function fetchCutoff() {
    if (!booking.rate_id) return
    try {
      const today = format(new Date(), "yyyy-MM-dd")
      const params = new URLSearchParams({
        start: `${today}T00:00:00.000Z`,
        end: `${today}T00:00:00.000Z`,
        rateId: booking.rate_id,
      })
      const res = await fetch(`/api/availability?${params.toString()}`)
      const data = await res.json()
      if (data.cutoff) setCutoff(new Date(data.cutoff))
    } catch {
      // best-effort — calendar falls back to "today" minimum
    }
  }

  async function fetchSlots(date: Date) {
    setLoadingSlots(true)
    setSelectedSlots([])
    const dateKey = format(date, "yyyy-MM-dd")
    const start = `${dateKey}T00:00:00.000Z`
    const end = `${dateKey}T23:59:59.999Z`

    try {
      const params = new URLSearchParams({ start, end })
      if (booking.rate_id) params.set("rateId", booking.rate_id)
      const res = await fetch(`/api/availability?${params.toString()}`)
      const data = await res.json()
      const dayData = data.availability?.[dateKey]
      setSlots(dayData?.slots || [])
      if (data.cutoff) setCutoff(new Date(data.cutoff))
    } catch {
      toast.error("Failed to fetch availability")
      setSlots([])
    }
    setLoadingSlots(false)
  }

  async function handleConfirm() {
    if (selectedSlots.length === 0) {
      toast.error("Please select new time slots")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlots: selectedSlots }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to reschedule")
        setSubmitting(false)
        return
      }

      toast.success(data.message || "Booking rescheduled successfully")
      onOpenChange(false)
      onRescheduled()
    } catch {
      toast.error("Failed to reschedule booking")
    }
    setSubmitting(false)
  }

  // Current booking slot info
  const activeSlots = booking.slots?.filter((s) => s.status !== "cancelled") || []
  const currentStart = activeSlots[0]?.start_time
  const currentEnd = activeSlots[activeSlots.length - 1]?.end_time

  // New slot info
  const newStart = selectedSlots.length > 0 ? selectedSlots[0].start : null
  const newEnd =
    selectedSlots.length > 0
      ? selectedSlots[selectedSlots.length - 1].end
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-secondary border-border sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide text-text-primary">
            <RefreshCw className="inline h-5 w-5 mr-2" />
            Reschedule Booking
          </DialogTitle>
        </DialogHeader>

        {/* Loading state */}
        {loadingFee && (
          <div className="py-8 text-center text-text-secondary">
            Checking reschedule options...
          </div>
        )}

        {/* Can't reschedule */}
        {feeInfo && !feeInfo.canReschedule && (
          <div className="py-6">
            <div className="bg-error/10 border border-error/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-error shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-text-primary">
                  Unable to Reschedule
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  {feeInfo.message ||
                    "Too close to booking time to reschedule."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Can reschedule */}
        {feeInfo && feeInfo.canReschedule && (
          <div className="space-y-6 py-2">
            {/* Current booking info */}
            <div className="bg-bg-elevated rounded-lg p-4">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-2">
                Current Booking
              </p>
              {currentStart && currentEnd && (
                <p className="text-sm text-text-primary font-mono">
                  {formatDate(currentStart)} &middot;{" "}
                  {formatTimeRange(currentStart, currentEnd)}
                </p>
              )}
            </div>

            {/* Fee tier notice */}
            {feeInfo.fee && (
              <div
                className={`rounded-lg p-4 border ${
                  feeInfo.fee.fee_cents > 0
                    ? "bg-warning/10 border-warning/20"
                    : "bg-success/10 border-success/20"
                }`}
              >
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">{feeInfo.fee.name}</span>
                  {" — "}
                  {feeInfo.fee.fee_cents > 0 ? (
                    <span className="text-warning font-bold">
                      {formatCents(feeInfo.fee.fee_cents)} fee
                    </span>
                  ) : (
                    <span className="text-success font-bold">No fee</span>
                  )}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {Math.round(feeInfo.hoursRemaining)} hours until your
                  booking
                </p>
              </div>
            )}

            {/* Date picker */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-2">
                Select New Date
              </p>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) =>
                    date < (cutoff ? startOfDay(cutoff) : startOfDay(new Date()))
                  }
                  className="rounded-md border border-border bg-bg-elevated"
                />
              </div>
            </div>

            {/* Time slot picker */}
            {selectedDate && (
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide mb-2">
                  Select New Time — {format(selectedDate, "EEEE, MMMM d")}
                </p>
                {loadingSlots ? (
                  <p className="text-text-secondary text-sm py-4">
                    Loading available times...
                  </p>
                ) : (
                  <TimeSlotGrid
                    slots={slots}
                    selectedSlots={selectedSlots}
                    onSlotsChanged={setSelectedSlots}
                    maxSlots={20}
                    minSlots={2}
                  />
                )}
              </div>
            )}

            {/* Summary */}
            {newStart && newEnd && currentStart && currentEnd && (
              <div className="bg-bg-elevated rounded-lg border border-brand-orange/20 p-4">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-3">
                  Reschedule Summary
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <div className="text-text-secondary">
                    <p className="text-xs text-text-muted mb-0.5">
                      Original
                    </p>
                    <p className="font-mono">
                      {new Date(currentStart).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      })}
                      ,{" "}
                      {formatTimeRange(currentStart, currentEnd)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-orange shrink-0" />
                  <div className="text-text-primary">
                    <p className="text-xs text-text-muted mb-0.5">New</p>
                    <p className="font-mono font-semibold">
                      {new Date(newStart).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      })}
                      ,{" "}
                      {formatTimeRange(newStart, newEnd)}
                    </p>
                  </div>
                </div>
                {feeInfo.fee && feeInfo.fee.fee_cents > 0 && (
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                    <span className="text-sm text-text-secondary">
                      Reschedule Fee
                    </span>
                    <span className="font-display font-bold text-brand-orange">
                      {formatCents(feeInfo.fee.fee_cents)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {feeInfo && feeInfo.canReschedule && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-text-primary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={submitting || selectedSlots.length === 0}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white"
            >
              {submitting ? "Rescheduling..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        )}

        {feeInfo && !feeInfo.canReschedule && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-text-primary"
            >
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

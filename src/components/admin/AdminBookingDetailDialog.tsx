"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/booking/BookingStatusBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  formatCents,
  formatDate,
  formatTimeRange,
} from "@/lib/utils/format"
import { toast } from "sonner"
import {
  ExternalLink,
  Loader2,
  CheckCircle,
  Trash2,
  Save,
} from "lucide-react"
import type { Booking } from "@/types"

interface Props {
  bookingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export function AdminBookingDetailDialog({
  bookingId,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [internalNotes, setInternalNotes] = useState("")

  useEffect(() => {
    if (!open || !bookingId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/bookings/${bookingId}`)
      const data = await res.json()
      if (cancelled) return
      setBooking(data.booking)
      setNotes(data.booking?.notes || "")
      setInternalNotes(data.booking?.internal_notes || "")
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, bookingId])

  const reload = async () => {
    if (!bookingId) return
    const res = await fetch(`/api/bookings/${bookingId}`)
    const data = await res.json()
    setBooking(data.booking)
    setNotes(data.booking?.notes || "")
    setInternalNotes(data.booking?.internal_notes || "")
  }

  const handleSaveNotes = async () => {
    if (!booking) return
    setSavingNotes(true)
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, internal_notes: internalNotes }),
    })
    if (res.ok) {
      toast.success("Notes saved")
      await reload()
      onChanged?.()
    } else {
      toast.error("Failed to save notes")
    }
    setSavingNotes(false)
  }

  const handleConfirmPayment = async () => {
    if (!booking) return
    const payment = booking.payments?.[0]
    if (!payment) {
      toast.error("No payment record on this booking")
      return
    }
    setConfirming(true)
    const res = await fetch("/api/payments/confirm-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id, paymentId: payment.id }),
    })
    if (res.ok) {
      toast.success("Payment confirmed")
      await reload()
      onChanged?.()
    } else {
      toast.error("Failed to confirm payment")
    }
    setConfirming(false)
  }

  const handleCancel = async () => {
    if (!booking) return
    setCancelling(true)
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "DELETE",
    })
    if (res.ok) {
      toast.success("Booking cancelled")
      onChanged?.()
      onOpenChange(false)
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to cancel")
    }
    setCancelling(false)
    setConfirmCancelOpen(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-bg-secondary border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide">
              {booking ? `Booking ${booking.booking_number}` : "Booking"}
            </DialogTitle>
          </DialogHeader>

          {loading || !booking ? (
            <p className="text-text-muted text-sm py-6 text-center">
              Loading…
            </p>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <BookingStatusBadge status={booking.status} />
                <PaymentStatusBadge status={booking.payment_status} />
              </div>

              <div className="bg-bg-elevated rounded-lg border border-border p-3 space-y-2 text-sm">
                <div>
                  <p className="text-text-muted text-xs uppercase tracking-wide">
                    Customer
                  </p>
                  <p className="font-semibold">
                    {booking.customer?.first_name}{" "}
                    {booking.customer?.last_name}
                  </p>
                  <p className="text-text-secondary text-xs">
                    {booking.customer?.email}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs uppercase tracking-wide">
                    Session
                  </p>
                  <p className="font-medium">{booking.rate?.name}</p>
                  {booking.slots && booking.slots.length > 0 && (() => {
                    const sorted = [...booking.slots]
                      .filter((s) => s.status !== "cancelled")
                      .sort(
                        (a, b) =>
                          new Date(a.start_time).getTime() -
                          new Date(b.start_time).getTime()
                      )
                    if (sorted.length === 0) return null
                    const first = sorted[0]
                    const last = sorted[sorted.length - 1]
                    return (
                      <p className="text-text-secondary text-xs font-mono">
                        {formatDate(first.start_time)} ·{" "}
                        {formatTimeRange(first.start_time, last.end_time)}
                      </p>
                    )
                  })()}
                </div>
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-text-muted text-xs uppercase tracking-wide">
                    Total
                  </span>
                  <span className="font-display font-bold text-brand-orange">
                    {formatCents(booking.total_cents)}
                  </span>
                </div>
              </div>

              {booking.payment_status === "pending_manual" && (
                <Button
                  onClick={handleConfirmPayment}
                  disabled={confirming}
                  className="w-full bg-success hover:bg-success/90 text-white"
                >
                  {confirming ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Confirm Payment Received
                </Button>
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
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="bg-bg-elevated border-border text-sm"
                />
              </div>

              <Button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                variant="outline"
                className="w-full border-border"
              >
                {savingNotes ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Notes
              </Button>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Link
                  href={`/admin/bookings/${booking.id}`}
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    className="w-full border-border text-text-secondary"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Full Details
                  </Button>
                </Link>
                {booking.status !== "cancelled" && (
                  <Button
                    onClick={() => setConfirmCancelOpen(true)}
                    disabled={cancelling}
                    variant="outline"
                    className="flex-1 border-error/40 text-error hover:bg-error/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Cancel Session
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Cancel Booking"
        description="This will mark the booking and all its time slots as cancelled. Continue?"
        confirmLabel="Cancel Booking"
        onConfirm={handleCancel}
        variant="destructive"
      />
    </>
  )
}

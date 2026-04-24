"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/booking/BookingStatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatCents,
  formatDate,
  formatTimeRange,
} from "@/lib/utils/format"
import { toast } from "sonner"
import {
  ArrowLeft,
  Key,
  Calendar,
  CreditCard,
  XCircle,
  Copy,
  RefreshCw,
} from "lucide-react"
import { RescheduleModal } from "@/components/bookings/RescheduleModal"
import type { Booking } from "@/types"

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/bookings/${params.id}`)
      const data = await res.json()
      setBooking(data.booking)
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleCancel = async () => {
    setCancelling(true)
    const res = await fetch(`/api/bookings/${params.id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Booking cancelled")
      router.push("/bookings")
    } else {
      toast.error("Failed to cancel booking")
    }
    setCancelling(false)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("Access code copied!")
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-bg-elevated" />
        <Skeleton className="h-64 bg-bg-elevated rounded-lg" />
      </div>
    )
  }

  if (!booking) {
    return <p className="text-text-secondary">Booking not found.</p>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/bookings">
        <Button variant="ghost" size="sm" className="text-text-secondary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Bookings
        </Button>
      </Link>

      <PageHeader
        title={`Booking ${booking.booking_number}`}
        action={
          <div className="flex gap-2">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.payment_status} />
          </div>
        }
      />

      {/* Details */}
      <Card className="bg-bg-secondary border-border mb-4">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-lg">
            <Calendar className="inline h-4 w-4 mr-2" />
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">Type</span>
            <span className="font-semibold">{booking.rate?.name}</span>
          </div>
          {booking.slots?.map((slot, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-text-secondary">
                Slot {booking.slots!.length > 1 ? i + 1 : ""}
              </span>
              <span className="font-mono text-sm">
                {formatDate(slot.start_time)} ·{" "}
                {formatTimeRange(slot.start_time, slot.end_time)}
              </span>
            </div>
          ))}
          {booking.participant_count > 1 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Participants</span>
              <span>{booking.participant_count}</span>
            </div>
          )}
          {booking.notes && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Notes</span>
              <span className="text-sm text-right max-w-xs">
                {booking.notes}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment */}
      <Card className="bg-bg-secondary border-border mb-4">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-lg">
            <CreditCard className="inline h-4 w-4 mr-2" />
            Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">Total</span>
            <span className="font-display font-bold text-brand-orange text-xl">
              {formatCents(booking.total_cents)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Method</span>
            <span className="capitalize">
              {booking.payment_method?.replace(/_/g, " ") || "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Status</span>
            <PaymentStatusBadge status={booking.payment_status} />
          </div>
        </CardContent>
      </Card>

      {/* Access Codes */}
      {booking.access_codes && booking.access_codes.length > 0 && (
        <Card className="bg-bg-secondary border-border mb-4">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide text-lg">
              <Key className="inline h-4 w-4 mr-2" />
              Access Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            {booking.access_codes.map((code) => (
              <div
                key={code.id}
                className="bg-bg-elevated rounded-lg p-4 text-center"
              >
                <p className="text-xs text-text-muted mb-2">
                  Your keybox PIN
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-mono font-bold tracking-[0.3em] text-success">
                    {code.pin_code}
                  </span>
                  <button
                    onClick={() => copyCode(code.pin_code)}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Valid for your session time only. Do not share.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {["confirmed", "pending_payment"].includes(booking.status) && (
        <div className="space-y-3">
          {booking.status === "confirmed" && (
            <Button
              variant="outline"
              onClick={() => setShowReschedule(true)}
              className="w-full border-brand-orange/30 text-brand-orange hover:bg-brand-orange/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reschedule Booking
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowCancel(true)}
            className="w-full border-error/30 text-error hover:bg-error/10"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Booking
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="Cancel Booking?"
        description="This action cannot be undone. If you paid, a refund will be processed within 3-5 business days."
        confirmLabel="Yes, Cancel"
        onConfirm={handleCancel}
        variant="destructive"
      />

      {booking.status === "confirmed" && (
        <RescheduleModal
          booking={booking}
          open={showReschedule}
          onOpenChange={setShowReschedule}
          onRescheduled={async () => {
            const res = await fetch(`/api/bookings/${params.id}`)
            const data = await res.json()
            setBooking(data.booking)
          }}
        />
      )}
    </div>
  )
}

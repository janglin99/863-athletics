"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
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
  User,
  CheckCircle,
  Loader2,
} from "lucide-react"
import type { Booking } from "@/types"

export default function AdminBookingDetailPage() {
  const params = useParams()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/bookings/${params.id}`)
      const data = await res.json()
      setBooking(data.booking)
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleConfirmPayment = async () => {
    if (!booking) return
    setConfirming(true)

    const payment = booking.payments?.[0]
    if (!payment) {
      toast.error("No payment found")
      setConfirming(false)
      return
    }

    const res = await fetch("/api/payments/confirm-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: booking.id,
        paymentId: payment.id,
      }),
    })

    if (res.ok) {
      toast.success("Payment confirmed!")
      // Reload
      const r2 = await fetch(`/api/bookings/${params.id}`)
      const d2 = await r2.json()
      setBooking(d2.booking)
    } else {
      toast.error("Failed to confirm payment")
    }
    setConfirming(false)
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
    <div className="max-w-3xl">
      <Link href="/admin/bookings">
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer */}
        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide text-sm">
              <User className="inline h-4 w-4 mr-2" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">
              {booking.customer?.first_name} {booking.customer?.last_name}
            </p>
            <p className="text-text-secondary">{booking.customer?.email}</p>
            <p className="text-text-secondary">{booking.customer?.phone || "No phone"}</p>
          </CardContent>
        </Card>

        {/* Session */}
        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide text-sm">
              <Calendar className="inline h-4 w-4 mr-2" />
              Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{booking.rate?.name}</p>
            {booking.slots?.map((slot, i) => (
              <p key={i} className="text-text-secondary font-mono">
                {formatDate(slot.start_time)} ·{" "}
                {formatTimeRange(slot.start_time, slot.end_time)}
              </p>
            ))}
            {booking.notes && (
              <p className="text-text-muted italic">{booking.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide text-sm">
              <CreditCard className="inline h-4 w-4 mr-2" />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Total</span>
              <span className="font-display font-bold text-brand-orange">
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

            {booking.payment_status === "pending_manual" && (
              <Button
                onClick={handleConfirmPayment}
                disabled={confirming}
                className="w-full mt-3 bg-success hover:bg-success/90 text-white"
              >
                {confirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Confirm Payment Received
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Access Codes */}
        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide text-sm">
              <Key className="inline h-4 w-4 mr-2" />
              Access Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {booking.access_codes && booking.access_codes.length > 0 ? (
              <div className="space-y-2">
                {booking.access_codes.map((code) => (
                  <div
                    key={code.id}
                    className="flex items-center justify-between bg-bg-elevated rounded p-3"
                  >
                    <span className="font-mono text-lg font-bold text-success">
                      {code.pin_code}
                    </span>
                    <span className="text-xs text-text-muted capitalize">
                      {code.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm">
                No access codes generated yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

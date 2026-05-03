"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/booking/BookingStatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { AdminBookingEditDialog } from "@/components/admin/AdminBookingEditDialog"
import { createClient } from "@/lib/supabase/client"
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
  Pencil,
  Trash2,
} from "lucide-react"
import type { Booking } from "@/types"

export default function AdminBookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generatingCodes, setGeneratingCodes] = useState(false)

  const reload = useCallback(async () => {
    const res = await fetch(`/api/bookings/${params.id}`)
    const data = await res.json()
    setBooking(data.booking)
  }, [params.id])

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/bookings/${params.id}`)
      const data = await res.json()
      setBooking(data.booking)
      setLoading(false)
    }
    load()
  }, [params.id])

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      setIsSuperAdmin(profile?.role === "admin")
    }
    checkRole()
  }, [])

  const handleDelete = async () => {
    if (!booking) return
    setDeleting(true)
    const res = await fetch(`/api/admin/bookings/${booking.id}`, {
      method: "DELETE",
    })
    const data = await res.json()
    setDeleting(false)
    setDeleteOpen(false)

    if (!res.ok) {
      toast.error(data.error || "Failed to delete booking")
      return
    }

    toast.success("Booking deleted")
    router.push("/admin/bookings")
  }

  const handleGenerateCodes = async () => {
    if (!booking) return
    setGeneratingCodes(true)
    const res = await fetch(
      `/api/admin/bookings/${booking.id}/access-codes`,
      { method: "POST" }
    )
    setGeneratingCodes(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Failed to generate codes")
      return
    }
    toast.success("Access codes requested — refreshing")
    await reload()
  }

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
          <div className="flex items-center gap-2 flex-wrap">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.payment_status} />
            {isSuperAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  className="border-border"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="border-error/40 text-error hover:bg-error/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </>
            )}
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
            {booking.slots && booking.slots.length > 0 && (() => {
              const sorted = [...booking.slots]
                .filter(s => s.status !== "cancelled")
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              if (sorted.length === 0) return null
              const first = sorted[0]
              const last = sorted[sorted.length - 1]
              const totalMs = sorted.reduce((ms, s) =>
                ms + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()), 0)
              const totalHours = totalMs / (1000 * 60 * 60)
              return (
                <p className="text-text-secondary font-mono">
                  {formatDate(first.start_time)} · {formatTimeRange(first.start_time, last.end_time)} ({totalHours}h)
                </p>
              )
            })()}
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
          <CardContent className="space-y-3">
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
            <Button
              onClick={handleGenerateCodes}
              disabled={generatingCodes}
              variant="outline"
              size="sm"
              className="w-full border-border"
            >
              {generatingCodes ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Key className="mr-2 h-4 w-4" />
              )}
              {booking.access_codes && booking.access_codes.length > 0
                ? "Regenerate / re-send codes"
                : "Generate & send access codes"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {isSuperAdmin && (
        <>
          <AdminBookingEditDialog
            booking={booking}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={reload}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete Booking"
            description={
              deleting
                ? "Deleting…"
                : "Permanently delete this booking and all associated slots, payments, access codes, and notifications? This cannot be undone."
            }
            confirmLabel={deleting ? "Deleting…" : "Delete Booking"}
            onConfirm={handleDelete}
            variant="destructive"
          />
        </>
      )}
    </div>
  )
}

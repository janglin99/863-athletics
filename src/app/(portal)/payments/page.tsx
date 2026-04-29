"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatCents,
  formatDate,
  formatDateTime,
  formatTime,
} from "@/lib/utils/format"
import { CreditCard, FileText, ChevronRight } from "lucide-react"
import type { Booking, Payment } from "@/types"

const paymentStatusColors: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/30",
  pending: "bg-warning/10 text-warning border-warning/30",
  failed: "bg-error/10 text-error border-error/30",
  refunded: "bg-text-muted/10 text-text-muted border-text-muted/30",
}

interface OpenInvoice {
  booking: Booking
  amountDueCents: number
}

export default function PaymentsPage() {
  const [tab, setTab] = useState<"open" | "history">("open")
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const [bookingsRes, paymentsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, rate:rates(*), slots:booking_slots(*), payments(*)")
          .eq("customer_id", user.id)
          .in("payment_status", ["unpaid", "pending_manual"])
          .neq("status", "cancelled")
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("*")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false }),
      ])

      const bookings = (bookingsRes.data ?? []) as Booking[]
      const open: OpenInvoice[] = bookings.map((b) => {
        const paid = (b.payments ?? [])
          .filter((p) => p.status === "completed")
          .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)
        return {
          booking: b,
          amountDueCents: Math.max(0, b.total_cents - paid),
        }
      })

      setOpenInvoices(open)
      setPayments(paymentsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const totalOpenCents = openInvoices.reduce(
    (sum, inv) => sum + inv.amountDueCents,
    0
  )

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Open invoices and payment history"
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "open" | "history")}
        className="mb-6"
      >
        <TabsList className="bg-bg-secondary">
          <TabsTrigger value="open">
            Open ({openInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : tab === "open" ? (
        openInvoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No open invoices"
            description="You're all paid up — outstanding bookings will appear here."
          />
        ) : (
          <>
            {totalOpenCents > 0 && (
              <Card className="bg-bg-secondary border-border mb-4">
                <CardContent className="py-4 flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    Total outstanding
                  </span>
                  <span className="font-display font-bold text-2xl text-brand-orange">
                    {formatCents(totalOpenCents)}
                  </span>
                </CardContent>
              </Card>
            )}
            <div className="space-y-3">
              {openInvoices.map(({ booking, amountDueCents }) => {
                const sortedSlots = [...(booking.slots ?? [])]
                  .filter((s) => s.status !== "cancelled")
                  .sort(
                    (a, b) =>
                      new Date(a.start_time).getTime() -
                      new Date(b.start_time).getTime()
                  )
                const firstSlot = sortedSlots[0]
                const lastSlot = sortedSlots[sortedSlots.length - 1]
                return (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="block"
                  >
                    <Card className="bg-bg-secondary border-border hover:border-brand-orange/40 transition-colors">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm truncate">
                                {booking.rate?.name || "Session"}
                              </p>
                              <Badge
                                variant="outline"
                                className="bg-warning/10 text-warning border-warning/30"
                              >
                                {booking.payment_status === "pending_manual"
                                  ? "Awaiting confirmation"
                                  : "Unpaid"}
                              </Badge>
                            </div>
                            <p className="text-xs text-text-muted font-mono mt-1">
                              #{booking.booking_number}
                              {firstSlot && (
                                <>
                                  {" · "}
                                  {formatDate(firstSlot.start_time)}
                                  {" · "}
                                  {formatTime(firstSlot.start_time)} -{" "}
                                  {formatTime(lastSlot.end_time)}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display font-bold text-brand-orange">
                              {formatCents(amountDueCents)}
                            </p>
                            <span className="inline-flex items-center text-xs text-text-secondary">
                              View
                              <ChevronRight className="h-3 w-3 ml-0.5" />
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </>
        )
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Payments will appear here after you book a session"
        />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <Card
              key={payment.id}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="capitalize text-sm font-medium">
                        {payment.method.replace(/_/g, " ")}
                      </span>
                      <Badge
                        variant="outline"
                        className={paymentStatusColors[payment.status] || ""}
                      >
                        {payment.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {formatDateTime(payment.created_at)}
                    </p>
                  </div>
                  <Link
                    href={`/bookings/${payment.booking_id}`}
                    className="text-right hover:text-brand-orange transition-colors"
                  >
                    <span className="font-display font-bold text-text-primary block">
                      {formatCents(payment.amount_cents)}
                    </span>
                    <span className="inline-flex items-center text-xs text-text-secondary">
                      View booking
                      <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

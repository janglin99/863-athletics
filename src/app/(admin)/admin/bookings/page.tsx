"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/booking/BookingStatusBadge"
import { AdminCreateBookingDialog } from "@/components/admin/AdminCreateBookingDialog"
import { AdminBookingCalendar } from "@/components/admin/AdminBookingCalendar"
import { formatCents, formatDateTime } from "@/lib/utils/format"
import { Search, List, Calendar as CalendarIcon } from "lucide-react"
import type { Booking } from "@/types"

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"list" | "calendar">("list")

  const loadBookings = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("bookings")
      .select(
        "*, customer:profiles!customer_id(first_name, last_name, email), rate:rates(name), slots:booking_slots(*)"
      )
      .order("created_at", { ascending: false })
      .limit(100)

    setBookings(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    async function run() {
      await loadBookings()
    }
    run()
  }, [loadBookings])

  const filtered = bookings
    .filter((b) => {
      if (filter === "all") return true
      if (filter === "pending") return b.payment_status === "pending_manual"
      if (filter === "confirmed") return b.status === "confirmed"
      if (filter === "cancelled") return b.status === "cancelled"
      return true
    })
    .filter((b) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        b.booking_number.toLowerCase().includes(q) ||
        b.customer?.first_name?.toLowerCase().includes(q) ||
        b.customer?.last_name?.toLowerCase().includes(q) ||
        b.customer?.email?.toLowerCase().includes(q)
      )
    })

  return (
    <div>
      <PageHeader
        title="All Bookings"
        description="Manage customer bookings"
        action={<AdminCreateBookingDialog onCreated={loadBookings} />}
      />

      <Tabs
        value={view}
        onValueChange={(v) => v && setView(v as "list" | "calendar")}
        className="mb-6"
      >
        <TabsList className="bg-bg-secondary">
          <TabsTrigger value="list">
            <List className="h-3.5 w-3.5 mr-1.5" />
            List
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            Calendar
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "calendar" ? (
        <AdminBookingCalendar />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Search by name, email, or booking #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-bg-elevated border-border"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => v && setFilter(v)}>
              <TabsList className="bg-bg-secondary">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
          {filtered.map((booking) => {
            const firstSlot = booking.slots?.[0]
            return (
              <Link key={booking.id} href={`/admin/bookings/${booking.id}`}>
                <Card className="bg-bg-secondary border-border hover:border-brand-orange/50 transition-colors cursor-pointer">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="font-mono text-xs text-text-muted w-20 shrink-0">
                          {booking.booking_number}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {booking.customer?.first_name}{" "}
                            {booking.customer?.last_name}
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            {booking.rate?.name}
                            {firstSlot &&
                              ` · ${formatDateTime(firstSlot.start_time)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <BookingStatusBadge status={booking.status} />
                        <PaymentStatusBadge status={booking.payment_status} />
                        <span className="font-display font-bold text-sm">
                          {formatCents(booking.total_cents)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}

              {filtered.length === 0 && (
                <p className="text-text-secondary text-center py-8">
                  No bookings found
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

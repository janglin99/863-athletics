"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge"
import { formatCents, formatDateTime } from "@/lib/utils/format"
import { ClipboardList, CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Booking } from "@/types"

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("bookings")
        .select("*, rate:rates(*), slots:booking_slots(*)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })

      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered =
    filter === "all"
      ? bookings
      : filter === "upcoming"
        ? bookings.filter((b) =>
            ["confirmed", "pending_payment"].includes(b.status)
          )
        : bookings.filter((b) =>
            ["completed", "cancelled", "refunded"].includes(b.status)
          )

  return (
    <div>
      <PageHeader
        title="My Bookings"
        description="View and manage your sessions"
        action={
          <Link href="/book">
            <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Book New
            </Button>
          </Link>
        }
      />

      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList className="bg-bg-secondary">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No bookings found"
          description="Book your first session to get started"
          action={
            <Link href="/book">
              <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white">
                Book a Session
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => {
            const firstSlot = booking.slots?.[0]

            return (
              <Link key={booking.id} href={`/bookings/${booking.id}`}>
                <Card className="bg-bg-secondary border-border hover:border-brand-orange/50 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-text-muted">
                            {booking.booking_number}
                          </span>
                          <BookingStatusBadge status={booking.status} />
                        </div>
                        <p className="font-semibold">{booking.rate?.name}</p>
                        {firstSlot && (
                          <p className="text-sm text-text-secondary">
                            {formatDateTime(firstSlot.start_time)} ·{" "}
                            {booking.slots?.length}h
                          </p>
                        )}
                      </div>
                      <p className="font-display font-bold text-brand-orange">
                        {formatCents(booking.total_cents)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

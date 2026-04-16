"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge"
import { formatCents, formatTime } from "@/lib/utils/format"
import {
  DollarSign,
  Calendar,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react"

interface AdminStats {
  totalCustomers: number
  todayBookings: Array<{
    start_time: string
    end_time: string
    booking: {
      id: string
      booking_number: string
      status: string
      total_cents: number
      customer: { first_name: string; last_name: string }
      rate: { name: string }
    }
  }>
  todayBookingCount: number
  pendingPayments: Array<{
    id: string
    booking_number: string
    total_cents: number
    customer: { first_name: string; last_name: string }
  }>
  pendingPaymentCount: number
  todayRevenueCents: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-bg-elevated" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-bg-elevated rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 bg-bg-elevated rounded-lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="Command center for 863 Athletics"
      />

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-success/10 p-2.5">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {formatCents(stats?.todayRevenueCents || 0)}
                </p>
                <p className="text-xs text-text-secondary">
                  Today&apos;s Revenue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-orange/10 p-2.5">
                <Calendar className="h-5 w-5 text-brand-orange" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {stats?.todayBookingCount || 0}
                </p>
                <p className="text-xs text-text-secondary">
                  Bookings Today
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-steel/10 p-2.5">
                <Users className="h-5 w-5 text-brand-steel" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {stats?.totalCustomers || 0}
                </p>
                <p className="text-xs text-text-secondary">
                  Total Customers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-bg-secondary border-border ${
            (stats?.pendingPaymentCount || 0) > 0 ? "border-warning/50" : ""
          }`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-warning/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {stats?.pendingPaymentCount || 0}
                </p>
                <p className="text-xs text-text-secondary">
                  Pending Payments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card className="bg-bg-secondary border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display uppercase tracking-wide">
              Today&apos;s Schedule
            </CardTitle>
            <Link href="/admin/bookings">
              <Button variant="ghost" size="sm" className="text-text-secondary">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.todayBookings && stats.todayBookings.length > 0 ? (
              <div className="space-y-3">
                {stats.todayBookings.map((slot, i) => (
                  <Link
                    key={i}
                    href={`/admin/bookings/${slot.booking.id}`}
                    className="flex items-center justify-between bg-bg-elevated rounded-lg p-3 hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[60px]">
                        <p className="text-xs text-text-muted">
                          {formatTime(slot.start_time)}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatTime(slot.end_time)}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {slot.booking.customer.first_name}{" "}
                          {slot.booking.customer.last_name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {slot.booking.rate.name}
                        </p>
                      </div>
                    </div>
                    <BookingStatusBadge status={slot.booking.status as any} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm py-4 text-center">
                No bookings scheduled for today
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">
              Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.pendingPayments && stats.pendingPayments.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-warning font-medium mb-2">
                  Manual payments awaiting confirmation:
                </p>
                {stats.pendingPayments.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/admin/bookings/${booking.id}`}
                    className="flex items-center justify-between bg-bg-elevated rounded-lg p-3 hover:bg-bg-hover transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {booking.customer.first_name}{" "}
                        {booking.customer.last_name}
                      </p>
                      <p className="text-xs font-mono text-text-muted">
                        {booking.booking_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-warning">
                        {formatCents(booking.total_cents)}
                      </p>
                      <Badge
                        variant="outline"
                        className="bg-warning/10 text-warning border-warning/30 text-xs"
                      >
                        Pending
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-text-secondary text-sm">
                  No pending actions
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

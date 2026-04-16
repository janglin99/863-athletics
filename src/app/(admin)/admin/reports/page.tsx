"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents } from "@/lib/utils/format"
import {
  DollarSign,
  CalendarCheck,
  Users,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react"

interface Stats {
  totalRevenue: number
  totalBookings: number
  confirmedBookings: number
  cancelledBookings: number
  pendingBookings: number
  completedBookings: number
  customerCount: number
}

export default function AdminReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [paymentsRes, bookingsRes, customersRes] = await Promise.all([
        supabase
          .from("payments")
          .select("amount_cents, status"),
        supabase
          .from("bookings")
          .select("status"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "customer"),
      ])

      const payments = paymentsRes.data || []
      const bookings = bookingsRes.data || []

      const totalRevenue = payments
        .filter((p) => p.status === "succeeded" || p.status === "confirmed")
        .reduce((sum, p) => sum + p.amount_cents, 0)

      setStats({
        totalRevenue,
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter((b) => b.status === "confirmed")
          .length,
        cancelledBookings: bookings.filter((b) => b.status === "cancelled")
          .length,
        pendingBookings: bookings.filter(
          (b) => b.status === "pending_payment"
        ).length,
        completedBookings: bookings.filter((b) => b.status === "completed")
          .length,
        customerCount: customersRes.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const cards = stats
    ? [
        {
          label: "Total Revenue",
          value: formatCents(stats.totalRevenue),
          icon: DollarSign,
          color: "text-green-400",
          bgColor: "bg-green-400/10",
        },
        {
          label: "Total Bookings",
          value: stats.totalBookings.toLocaleString(),
          icon: CalendarCheck,
          color: "text-brand-orange",
          bgColor: "bg-brand-orange/10",
        },
        {
          label: "Customers",
          value: stats.customerCount.toLocaleString(),
          icon: Users,
          color: "text-blue-400",
          bgColor: "bg-blue-400/10",
        },
        {
          label: "Confirmed",
          value: stats.confirmedBookings.toLocaleString(),
          icon: CheckCircle,
          color: "text-green-400",
          bgColor: "bg-green-400/10",
        },
        {
          label: "Completed",
          value: stats.completedBookings.toLocaleString(),
          icon: CheckCircle,
          color: "text-emerald-400",
          bgColor: "bg-emerald-400/10",
        },
        {
          label: "Pending",
          value: stats.pendingBookings.toLocaleString(),
          icon: Clock,
          color: "text-yellow-400",
          bgColor: "bg-yellow-400/10",
        },
        {
          label: "Cancelled",
          value: stats.cancelledBookings.toLocaleString(),
          icon: XCircle,
          color: "text-red-400",
          bgColor: "bg-red-400/10",
        },
      ]
    : []

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Overview of key platform metrics"
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-32 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <Card
              key={card.label}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${card.bgColor}`}
                  >
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <span className="text-sm text-text-secondary">
                    {card.label}
                  </span>
                </div>
                <p className="text-3xl font-display font-bold tracking-wide text-text-primary">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

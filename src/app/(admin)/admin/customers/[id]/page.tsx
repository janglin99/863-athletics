"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge"
import { formatCents, formatDateTime, formatPhone } from "@/lib/utils/format"
import { ArrowLeft, Mail, Phone, Calendar, Shield } from "lucide-react"
import type { Profile, Booking } from "@/types"

export default function AdminCustomerDetailPage() {
  const params = useParams()
  const [customer, setCustomer] = useState<Profile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: profile }, { data: customerBookings }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", params.id)
            .single(),
          supabase
            .from("bookings")
            .select("*, rate:rates(name), slots:booking_slots(*)")
            .eq("customer_id", params.id as string)
            .order("created_at", { ascending: false })
            .limit(20),
        ])

      setCustomer(profile)
      setBookings(customerBookings || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-bg-elevated" />
        <Skeleton className="h-48 bg-bg-elevated rounded-lg" />
      </div>
    )
  }

  if (!customer) return <p className="text-text-secondary">Customer not found.</p>

  const totalSpent = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((sum, b) => sum + b.total_cents, 0)

  return (
    <div className="max-w-3xl">
      <Link href="/admin/customers">
        <Button variant="ghost" size="sm" className="text-text-secondary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Customers
        </Button>
      </Link>

      <PageHeader
        title={`${customer.first_name} ${customer.last_name}`}
        description={`Member since ${formatDateTime(customer.created_at)}`}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-display font-bold">{bookings.length}</p>
            <p className="text-xs text-text-secondary">Total Bookings</p>
          </CardContent>
        </Card>
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-display font-bold text-brand-orange">
              {formatCents(totalSpent)}
            </p>
            <p className="text-xs text-text-secondary">Total Spent</p>
          </CardContent>
        </Card>
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-display font-bold">
              {customer.waiver_signed ? "Yes" : "No"}
            </p>
            <p className="text-xs text-text-secondary">Waiver Signed</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-bg-secondary border-border mb-6">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-sm">
            Contact Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-text-muted" />
            <span>{customer.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-text-muted" />
            <span>
              {customer.phone ? formatPhone(customer.phone) : "No phone"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-text-muted" />
            <span className="capitalize">{customer.role}</span>
          </div>
        </CardContent>
      </Card>

      <h3 className="font-display font-bold uppercase tracking-wide mb-3">
        Booking History
      </h3>
      <div className="space-y-2">
        {bookings.map((booking) => {
          const firstSlot = booking.slots?.[0]
          return (
            <Link key={booking.id} href={`/admin/bookings/${booking.id}`}>
              <Card className="bg-bg-secondary border-border hover:border-brand-orange/50 transition-colors cursor-pointer">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-muted">
                          {booking.booking_number}
                        </span>
                        <BookingStatusBadge status={booking.status} />
                      </div>
                      <p className="text-sm text-text-secondary">
                        {booking.rate?.name}
                        {firstSlot && ` · ${formatDateTime(firstSlot.start_time)}`}
                      </p>
                    </div>
                    <span className="font-display font-bold">
                      {formatCents(booking.total_cents)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

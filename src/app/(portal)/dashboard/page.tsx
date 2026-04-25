"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/booking/BookingStatusBadge"
import { formatCents, formatDateTime, formatTimeRange } from "@/lib/utils/format"
import {
  CalendarPlus,
  Clock,
  ClipboardList,
  Key,
  ArrowRight,
  DollarSign,
  Ticket,
} from "lucide-react"
import type { Booking, Profile, UserCredit } from "@/types"

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [credits, setCredits] = useState<UserCredit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profileData }, { data: bookingsData }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase
            .from("bookings")
            .select("*, rate:rates(*), slots:booking_slots(*), access_codes(*)")
            .eq("customer_id", user.id)
            .in("status", ["confirmed", "pending_payment"])
            .order("created_at", { ascending: false })
            .limit(5),
        ])

      setProfile(profileData)
      setUpcoming(bookingsData || [])

      // Load credits
      const creditsRes = await fetch("/api/credits")
      const creditsData = await creditsRes.json()
      setCredits(creditsData.credits || [])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-bg-elevated" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-bg-elevated rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 bg-bg-elevated rounded-lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.first_name || "Athlete"}`}
        description="Your training hub at 863 Athletics"
        action={
          <Link href="/book">
            <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Book Session
            </Button>
          </Link>
        }
      />

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-orange/10 p-2.5">
                <Clock className="h-5 w-5 text-brand-orange" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {upcoming.filter((b) => b.status === "confirmed").length}
                </p>
                <p className="text-xs text-text-secondary">Upcoming Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-brand-steel/10 p-2.5">
                <ClipboardList className="h-5 w-5 text-brand-steel" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {upcoming.length}
                </p>
                <p className="text-xs text-text-secondary">Active Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-success/10 p-2.5">
                <Key className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {upcoming.reduce(
                    (n, b) =>
                      n +
                      (b.access_codes?.filter((c) => c.status === "active")
                        .length || 0),
                    0
                  )}
                </p>
                <p className="text-xs text-text-secondary">Active Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Credits */}
      {credits.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-display font-bold uppercase tracking-wide mb-4">
            Your Credits
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {credits.map((credit) => {
              const typeColor =
                credit.credit_type === "dollar"
                  ? "text-success"
                  : credit.credit_type === "hours"
                    ? "text-brand-steel"
                    : "text-brand-orange"
              const bgColor =
                credit.credit_type === "dollar"
                  ? "bg-success/10"
                  : credit.credit_type === "hours"
                    ? "bg-brand-steel/10"
                    : "bg-brand-orange/10"
              const TypeIcon =
                credit.credit_type === "dollar"
                  ? DollarSign
                  : credit.credit_type === "hours"
                    ? Clock
                    : Ticket

              return (
                <Card key={credit.id} className="bg-bg-secondary border-border">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`rounded-md ${bgColor} p-2`}>
                        <TypeIcon className={`h-4 w-4 ${typeColor}`} />
                      </div>
                      <div>
                        <p className={`text-lg font-display font-bold ${typeColor}`}>
                          {credit.credit_type === "dollar"
                            ? `$${Number(credit.remaining_amount).toFixed(2)}`
                            : credit.credit_type === "hours"
                              ? `${Number(credit.remaining_amount)} hrs`
                              : `${Number(credit.remaining_amount)} sessions`}
                        </p>
                        <p className="text-xs text-text-secondary capitalize">
                          {credit.credit_type} credit
                        </p>
                      </div>
                    </div>
                    {credit.description && (
                      <p className="text-xs text-text-muted">{credit.description}</p>
                    )}
                    {credit.expires_at && (
                      <p className="text-xs text-text-muted mt-1">
                        Expires {new Date(credit.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold uppercase tracking-wide">
            Upcoming Sessions
          </h2>
          <Link
            href="/bookings"
            className="text-sm text-brand-orange hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <Card className="bg-bg-secondary border-border">
            <CardContent className="py-12 text-center">
              <p className="text-text-secondary mb-4">No upcoming sessions</p>
              <Link href="/book">
                <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white">
                  Book Your First Session
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((booking) => {
              const firstSlot = booking.slots?.[0]
              const accessCode = booking.access_codes?.find(
                (c) => c.status === "active"
              )

              return (
                <Link key={booking.id} href={`/bookings/${booking.id}`}>
                  <Card className="bg-bg-secondary border-border hover:border-brand-orange/50 transition-colors cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-text-muted">
                              {booking.booking_number}
                            </span>
                            <BookingStatusBadge status={booking.status} />
                          </div>
                          <p className="font-semibold">
                            {booking.rate?.name}
                          </p>
                          {firstSlot && (
                            <p className="text-sm text-text-secondary">
                              {formatDateTime(firstSlot.start_time)} ·{" "}
                              {booking.slots?.length}h
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-display font-bold text-brand-orange">
                            {formatCents(booking.total_cents)}
                          </p>
                          {accessCode && (
                            <p className="text-xs font-mono text-success mt-1">
                              PIN: {accessCode.pin_code}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/booking/BookingStatusBadge"
import { AdminCreateBookingDialog } from "@/components/admin/AdminCreateBookingDialog"
import { AdminBookingCalendar } from "@/components/admin/AdminBookingCalendar"
import { formatCents, formatDate, formatDateTime } from "@/lib/utils/format"
import { toast } from "sonner"
import {
  Search,
  List,
  Calendar as CalendarIcon,
  Trash2,
  Tag,
  Key,
  Loader2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Booking } from "@/types"

type GroupBy = "none" | "customer" | "date"

interface BookingGroup {
  key: string
  label: string
  bookings: Booking[]
  totalCents: number
}

// Earliest non-cancelled slot start_time, falling back to created_at so
// bookings without scheduled slots still group under something sensible.
function bookingAnchorTime(b: Booking): string {
  const active = (b.slots ?? []).filter((s) => s.status !== "cancelled")
  if (active.length === 0) return b.created_at
  return active.reduce(
    (min, s) => (s.start_time < min ? s.start_time : min),
    active[0].start_time
  )
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"list" | "calendar">("list")
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [bulkPromoOpen, setBulkPromoOpen] = useState(false)
  const [bulkPromoCode, setBulkPromoCode] = useState("")
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [refreshingCodes, setRefreshingCodes] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupBy>("none")

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
    loadBookings()
  }, [loadBookings])

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

  const filtered = useMemo(
    () =>
      bookings
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
        }),
    [bookings, filter, search]
  )

  const groups = useMemo<BookingGroup[]>(() => {
    if (groupBy === "none") return []

    const map = new Map<string, BookingGroup>()
    for (const b of filtered) {
      let key: string
      let label: string
      if (groupBy === "customer") {
        key = b.customer_id
        const name = `${b.customer?.first_name ?? ""} ${
          b.customer?.last_name ?? ""
        }`.trim()
        label = name || b.customer?.email || "Unknown customer"
      } else {
        // date — use ET date of the earliest active slot (or created_at as fallback)
        const anchor = new Date(bookingAnchorTime(b))
        key = anchor.toLocaleDateString("en-CA", {
          timeZone: "America/New_York",
        })
        label = formatDate(anchor.toISOString())
      }
      const existing = map.get(key)
      if (existing) {
        existing.bookings.push(b)
        existing.totalCents += b.total_cents
      } else {
        map.set(key, {
          key,
          label,
          bookings: [b],
          totalCents: b.total_cents,
        })
      }
    }

    const arr = Array.from(map.values())
    if (groupBy === "customer") {
      arr.sort((a, b) => a.label.localeCompare(b.label))
    } else {
      // Most recent date first
      arr.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
    }
    return arr
  }, [filtered, groupBy])

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((b) => b.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id))

  const renderBookingRow = (booking: Booking) => {
    const firstSlot = booking.slots?.[0]
    const isSelected = selectedIds.has(booking.id)
    const row = (
      <Card
        className={`bg-bg-secondary border-border transition-colors ${
          isSelected
            ? "border-brand-orange/60"
            : "hover:border-brand-orange/50"
        } ${isSuperAdmin ? "" : "cursor-pointer"}`}
      >
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
    )

    if (!isSuperAdmin) {
      return (
        <Link key={booking.id} href={`/admin/bookings/${booking.id}`}>
          {row}
        </Link>
      )
    }

    return (
      <div key={booking.id} className="flex items-center gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(c) => toggleOne(booking.id, c === true)}
          aria-label={`Select booking ${booking.booking_number}`}
          className="shrink-0"
        />
        <Link
          href={`/admin/bookings/${booking.id}`}
          className="flex-1 min-w-0"
        >
          {row}
        </Link>
      </div>
    )
  }

  const handleBulkRefreshCodes = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setRefreshingCodes(true)
    const res = await fetch("/api/admin/bookings/bulk-refresh-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingIds: ids }),
    })
    const data = await res.json()
    setRefreshingCodes(false)
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Failed")
      return
    }
    if (data.failed === 0) {
      toast.success(
        `Refreshed access codes on ${data.refreshed} booking${
          data.refreshed === 1 ? "" : "s"
        }`
      )
    } else {
      toast.warning(
        `Refreshed ${data.refreshed} of ${ids.length}. ${data.failed} failed: ${data.failureReasons?.[0] ?? "unknown"}`
      )
    }
    clearSelection()
    await loadBookings()
  }

  const handleBulkApplyPromo = async () => {
    const code = bulkPromoCode.trim()
    if (!code) {
      toast.error("Enter a promo code")
      return
    }
    const ids = Array.from(selectedIds)
    setApplyingPromo(true)
    const res = await fetch("/api/admin/bookings/bulk-apply-promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingIds: ids, promoCode: code }),
    })
    const data = await res.json()
    setApplyingPromo(false)

    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Failed")
      return
    }

    const appliedCount = data.applied?.length ?? 0
    const skippedCount = data.skipped?.length ?? 0
    const totalDiscount = data.totalDiscountCents ?? 0
    const totalOver = data.totalOverpaymentCents ?? 0

    if (appliedCount === 0) {
      const reason: string =
        data.skipped?.[0]?.reason ?? "No bookings updated"
      toast.error(`Nothing applied: ${reason}`)
    } else {
      const overNote =
        totalOver > 0
          ? ` · $${(totalOver / 100).toFixed(2)} overpaid across ${appliedCount} bookings — review individually.`
          : ""
      const skipNote =
        skippedCount > 0
          ? ` · ${skippedCount} skipped (${data.skipped[0].reason})`
          : ""
      toast.success(
        `Applied to ${appliedCount} (-$${(totalDiscount / 100).toFixed(2)}).${skipNote}${overNote}`
      )
    }

    setBulkPromoOpen(false)
    setBulkPromoCode("")
    clearSelection()
    await loadBookings()
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setDeleting(true)

    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/admin/bookings/${id}`, { method: "DELETE" }).then(
          async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              throw new Error(data.error || `Failed (${res.status})`)
            }
            return id
          }
        )
      )
    )

    const ok = results.filter((r) => r.status === "fulfilled").length
    const failed = results.length - ok
    const failureReasons = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))

    setDeleting(false)
    setConfirmDeleteOpen(false)

    if (failed === 0) {
      toast.success(
        ok === 1 ? "Booking deleted" : `Deleted ${ok} bookings`
      )
    } else if (ok === 0) {
      toast.error(
        failureReasons[0] || "Failed to delete bookings"
      )
    } else {
      toast.warning(
        `Deleted ${ok} of ${ids.length}. ${failed} failed: ${failureReasons[0]}`
      )
    }

    clearSelection()
    await loadBookings()
  }

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

          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs uppercase tracking-wide text-text-muted">
              Group by
            </span>
            <Tabs
              value={groupBy}
              onValueChange={(v) => v && setGroupBy(v as GroupBy)}
            >
              <TabsList className="bg-bg-secondary">
                <TabsTrigger value="none">None</TabsTrigger>
                <TabsTrigger value="customer">Customer</TabsTrigger>
                <TabsTrigger value="date">Date</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isSuperAdmin && filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-md bg-bg-secondary border border-border">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(c) => toggleAllVisible(c === true)}
                />
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `Select all (${filtered.length})`}
              </label>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-text-secondary"
                  >
                    Clear
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkRefreshCodes}
                    disabled={refreshingCodes}
                    className="border-border"
                  >
                    {refreshingCodes ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4 mr-1" />
                    )}
                    Refresh codes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkPromoOpen(true)}
                    className="border-border"
                  >
                    <Tag className="h-4 w-4 mr-1" />
                    Apply discount
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="border-error/40 text-error hover:bg-error/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete {selectedIds.size}
                  </Button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
              ))}
            </div>
          ) : groupBy === "none" ? (
            <div className="space-y-2">
              {filtered.map(renderBookingRow)}
              {filtered.length === 0 && (
                <p className="text-text-secondary text-center py-8">
                  No bookings found
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.key}>
                  <header className="flex items-center justify-between gap-3 mb-2 px-1">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <h3 className="font-display font-bold uppercase tracking-wide text-sm truncate">
                        {group.label}
                      </h3>
                      <span className="text-xs text-text-muted shrink-0">
                        {group.bookings.length}{" "}
                        {group.bookings.length === 1 ? "booking" : "bookings"}
                      </span>
                    </div>
                    <span className="font-display font-bold text-sm text-brand-orange shrink-0">
                      {formatCents(group.totalCents)}
                    </span>
                  </header>
                  <div className="space-y-2">
                    {group.bookings.map(renderBookingRow)}
                  </div>
                </section>
              ))}
              {groups.length === 0 && (
                <p className="text-text-secondary text-center py-8">
                  No bookings found
                </p>
              )}
            </div>
          )}
        </>
      )}

      {isSuperAdmin && (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title={`Delete ${selectedIds.size} booking${
            selectedIds.size === 1 ? "" : "s"
          }?`}
          description={
            deleting
              ? "Deleting…"
              : "Permanently delete the selected bookings and all associated slots, payments, access codes, and notifications. Cannot be undone. Bookings included in trainer invoices will be skipped."
          }
          confirmLabel={
            deleting
              ? "Deleting…"
              : `Delete ${selectedIds.size} booking${
                  selectedIds.size === 1 ? "" : "s"
                }`
          }
          onConfirm={handleBulkDelete}
          variant="destructive"
        />
      )}

      {isSuperAdmin && (
        <Dialog open={bulkPromoOpen} onOpenChange={setBulkPromoOpen}>
          <DialogContent className="bg-bg-secondary border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display uppercase tracking-wide">
                Apply discount to {selectedIds.size} booking
                {selectedIds.size === 1 ? "" : "s"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Promo code</Label>
                <Input
                  value={bulkPromoCode}
                  onChange={(e) => setBulkPromoCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleBulkApplyPromo()
                    }
                  }}
                  placeholder="GLAM"
                  className="bg-bg-elevated border-border font-mono uppercase"
                  maxLength={64}
                  disabled={applyingPromo}
                />
              </div>
              <p className="text-xs text-text-muted">
                Server validates the code against each booking and recomputes
                its total. Counts as 1 redemption for the whole batch.
                Bookings that already have a discount are skipped. Doesn&apos;t
                touch payments — review individual bookings to refund or
                credit overpayments.
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setBulkPromoOpen(false)}
                  disabled={applyingPromo}
                  className="flex-1 border-border"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkApplyPromo}
                  disabled={applyingPromo || !bulkPromoCode.trim()}
                  className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white"
                >
                  {applyingPromo && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-bg-secondary border border-border rounded-lg px-6 py-4 flex items-center gap-3 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-brand-orange" />
            <span className="text-sm text-text-primary">
              Deleting {selectedIds.size} booking
              {selectedIds.size === 1 ? "" : "s"}…
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

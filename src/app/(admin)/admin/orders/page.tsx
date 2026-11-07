"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { formatCents, formatDateTime } from "@/lib/utils/format"
import type { ShopOrder } from "@/app/api/admin/orders/route"

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/orders")
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || "Failed to load orders")
        setOrders(body.orders)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orders")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleFulfilled(o: ShopOrder) {
    const fulfilled = !o.fulfilledAt
    setBusyId(o.id)
    try {
      const res = await fetch(`/api/admin/orders/${o.id}/fulfill`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfilled }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not update order")
      setOrders((prev) =>
        prev.map((x) =>
          x.id === o.id ? { ...x, fulfilledAt: body.fulfilledAt } : x
        )
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update order")
    } finally {
      setBusyId(null)
    }
  }

  const filtered = orders.filter((o) => {
    if (filter === "all") return true
    if (filter === "todo") return !o.fulfilledAt && !o.refunded
    if (filter === "refunded") return o.refunded
    return o.fulfillment === filter && !o.refunded
  })

  const revenue = orders
    .filter((o) => !o.refunded)
    .reduce((sum, o) => sum + o.totalCents, 0)

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${orders.length} shop orders · ${formatCents(revenue)} total`}
      />

      <div className="mb-6">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-bg-secondary">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="todo">To do</TabsTrigger>
            <TabsTrigger value="pickup">Pickup</TabsTrigger>
            <TabsTrigger value="ship">Ship</TabsTrigger>
            <TabsTrigger value="refunded">Refunded</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="text-red-400 text-center py-8">{error}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <Card key={o.id} className="bg-bg-secondary border-border">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-sm">
                      {o.name || "Unknown customer"}{" "}
                      <span className="text-text-muted font-normal">
                        #{o.ref}
                      </span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      {[o.email, o.phone].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-sm">
                      Size {o.size} × {o.quantity}
                    </p>
                    <p className="text-xs text-text-secondary whitespace-pre-line">
                      {o.fulfillment === "pickup"
                        ? `Pickup: ${o.pickupAddress ?? "—"}`
                        : `Ship to:\n${o.shippingAddress ?? "—"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant="outline"
                      className="capitalize text-xs border-border"
                    >
                      {o.fulfillment === "pickup" ? "Pickup" : "Ship"}
                    </Badge>
                    {o.refunded && (
                      <Badge
                        variant="outline"
                        className="text-xs border-blue-500/50 text-blue-400"
                      >
                        Refunded
                      </Badge>
                    )}
                    {o.fulfilledAt && (
                      <Badge
                        variant="outline"
                        className="text-xs border-green-500/50 text-green-400"
                      >
                        {o.fulfillment === "pickup" ? "Picked up" : "Shipped"}
                      </Badge>
                    )}
                    <div className="text-right">
                      <p className="font-display font-bold text-sm">
                        {formatCents(o.totalCents)}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatDateTime(o.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                {!o.refunded && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant={o.fulfilledAt ? "outline" : "default"}
                      disabled={busyId === o.id}
                      onClick={() => toggleFulfilled(o)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {o.fulfilledAt
                        ? "Undo"
                        : o.fulfillment === "pickup"
                          ? "Mark picked up"
                          : "Mark shipped"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <p className="text-text-secondary text-center py-8">
              No orders found
            </p>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatCents, formatDateTime } from "@/lib/utils/format"
import type { Payment } from "@/types"

type PaymentWithCustomer = Payment & {
  customer?: { first_name: string; last_name: string; email: string }
}

const STATUS_COLORS: Record<string, string> = {
  succeeded: "border-green-500/50 text-green-400",
  pending: "border-yellow-500/50 text-yellow-400",
  failed: "border-red-500/50 text-red-400",
  refunded: "border-blue-500/50 text-blue-400",
  confirmed: "border-green-500/50 text-green-400",
  pending_manual: "border-yellow-500/50 text-yellow-400",
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithCustomer[]>([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("payments")
        .select(
          "*, customer:profiles!customer_id(first_name, last_name, email)"
        )
        .order("created_at", { ascending: false })
        .limit(100)

      setPayments(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = payments.filter((p) => {
    if (filter === "all") return true
    return p.status === filter
  })

  const statuses = Array.from(new Set(payments.map((p) => p.status)))

  return (
    <div>
      <PageHeader
        title="Payments"
        description={`${payments.length} total payments`}
      />

      <div className="mb-6">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-bg-secondary">
            <TabsTrigger value="all">All</TabsTrigger>
            {statuses.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </TabsTrigger>
            ))}
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
          {filtered.map((payment) => (
            <Card
              key={payment.id}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {payment.customer
                          ? `${payment.customer.first_name} ${payment.customer.last_name}`
                          : "Unknown customer"}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {payment.customer?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant="outline"
                      className="capitalize text-xs border-border"
                    >
                      {payment.method || "N/A"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`capitalize text-xs ${
                        STATUS_COLORS[payment.status] || "border-border"
                      }`}
                    >
                      {payment.status.replace("_", " ")}
                    </Badge>
                    <span className="font-display font-bold text-sm w-20 text-right">
                      {formatCents(payment.amount_cents)}
                    </span>
                    <span className="text-xs text-text-muted w-36 text-right">
                      {formatDateTime(payment.created_at)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <p className="text-text-secondary text-center py-8">
              No payments found
            </p>
          )}
        </div>
      )}
    </div>
  )
}

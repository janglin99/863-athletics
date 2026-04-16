"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents, formatDateTime } from "@/lib/utils/format"
import { CreditCard } from "lucide-react"
import type { Payment } from "@/types"

const statusColors: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/30",
  pending: "bg-warning/10 text-warning border-warning/30",
  failed: "bg-error/10 text-error border-error/30",
  refunded: "bg-text-muted/10 text-text-muted border-text-muted/30",
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })

      setPayments(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <PageHeader
        title="Payment History"
        description="View all your transactions"
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
          ))}
        </div>
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
                        className={statusColors[payment.status] || ""}
                      >
                        {payment.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {formatDateTime(payment.created_at)}
                    </p>
                  </div>
                  <span className="font-display font-bold text-text-primary">
                    {formatCents(payment.amount_cents)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

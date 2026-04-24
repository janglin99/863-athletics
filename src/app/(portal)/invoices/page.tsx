"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents } from "@/lib/utils/format"
import { ChevronDown, ChevronUp, FileText, Printer } from "lucide-react"
import Link from "next/link"
import type { TrainerInvoice, InvoiceItem } from "@/types"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function TrainerInvoicesPage() {
  const [invoices, setInvoices] = useState<TrainerInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadInvoices = useCallback(async () => {
    const supabase = createClient()
    const res = await fetch("/api/trainer-invoices")
    if (res.ok) {
      const data = await res.json()
      setInvoices(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const statusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "border-green-500/50 text-green-400"
      case "invoiced":
        return "border-yellow-500/50 text-yellow-400"
      default:
        return "border-border text-text-muted"
    }
  }

  return (
    <div>
      <PageHeader
        title="My Invoices"
        description="View your monthly invoices and line items"
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <Card className="bg-bg-secondary border-border">
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary text-sm">
              No invoices found. Invoices will appear here once generated.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const expanded = expandedId === invoice.id
            const items = invoice.items || []
            return (
              <Card key={invoice.id} className="bg-bg-secondary border-border">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-semibold text-sm">
                          {MONTHS[invoice.month - 1]} {invoice.year}
                        </p>
                        <p className="text-xs text-text-muted">
                          {invoice.total_sessions} sessions &middot;{" "}
                          {Number(invoice.total_hours).toFixed(1)} hours
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">
                        {formatCents(invoice.total_amount_cents)}
                      </span>
                      <Badge variant="outline" className={statusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                      <Link href={`/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Printer className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedId(expanded ? null : invoice.id)
                        }
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expanded && items.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-text-muted text-left">
                            <th className="pb-2 font-medium">Date</th>
                            <th className="pb-2 font-medium">Time</th>
                            <th className="pb-2 font-medium text-center">Hours</th>
                            <th className="pb-2 font-medium text-right">Rate</th>
                            <th className="pb-2 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item: InvoiceItem) => (
                            <tr key={item.id} className="border-b border-border/30">
                              <td className="py-2">
                                {new Date(item.session_date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  timeZone: "America/New_York",
                                })}
                              </td>
                              <td className="py-2">
                                {new Date(item.start_time).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  timeZone: "America/New_York",
                                })}
                                {" - "}
                                {new Date(item.end_time).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  timeZone: "America/New_York",
                                })}
                              </td>
                              <td className="py-2 text-center">
                                {Number(item.hours).toFixed(1)}
                              </td>
                              <td className="py-2 text-right">
                                {formatCents(item.rate_cents)}
                              </td>
                              <td className="py-2 text-right">
                                {formatCents(item.amount_cents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

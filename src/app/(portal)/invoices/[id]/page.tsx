"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents } from "@/lib/utils/format"
import { ArrowLeft, Printer } from "lucide-react"
import type { TrainerInvoice, InvoiceItem } from "@/types"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<TrainerInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (!profile) {
        router.push("/login")
        return
      }

      const isAdmin = ["admin", "staff"].includes(profile.role)

      // Fetch the invoice
      const { data: inv } = await supabase
        .from("trainer_invoices")
        .select("*, trainer:profiles!trainer_id(*), items:invoice_items(*)")
        .eq("id", params.id)
        .single()

      if (!inv) {
        setLoading(false)
        return
      }

      // Check authorization: must be admin or the trainer
      if (!isAdmin && inv.trainer_id !== user.id) {
        setLoading(false)
        return
      }

      setAuthorized(true)
      setInvoice(inv)
      setLoading(false)
    }
    load()
  }, [params.id, router])

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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 p-6">
        <Skeleton className="h-8 w-48 bg-bg-elevated" />
        <Skeleton className="h-64 bg-bg-elevated rounded-lg" />
      </div>
    )
  }

  if (!invoice || !authorized) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-text-secondary">Invoice not found or access denied.</p>
      </div>
    )
  }

  const items = invoice.items || []
  const trainer = invoice.trainer

  return (
    <>
      <style jsx global>{`
        @media print {
          nav, aside, .no-print, header, footer {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-container * {
            color: black !important;
            border-color: #ddd !important;
          }
        }
      `}</style>

      <div className="max-w-3xl mx-auto print-container">
        {/* No-print nav buttons */}
        <div className="flex items-center justify-between mb-6 no-print">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={() => window.print()}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
        </div>

        {/* Invoice Header */}
        <div className="border border-border rounded-lg p-8 bg-bg-secondary">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-display font-bold uppercase tracking-wide">
                863 ATHLETICS
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                863 Athletics Training Facility
              </p>
              <p className="text-xs text-text-muted">
                Lakeland, FL
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-display font-bold uppercase tracking-wide">
                INVOICE
              </h2>
              <p className="text-xs text-text-muted mt-1">
                #{invoice.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-text-muted">
                Generated: {new Date(invoice.created_at).toLocaleDateString("en-US")}
              </p>
              <p className="text-xs text-text-muted">
                Period: {MONTHS[invoice.month - 1]} {invoice.year}
              </p>
            </div>
          </div>

          {/* Trainer Info */}
          <div className="mb-6 pb-6 border-b border-border">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">
              Bill To
            </p>
            {trainer && (
              <>
                <p className="font-semibold text-sm">
                  {trainer.first_name} {trainer.last_name}
                </p>
                <p className="text-xs text-text-secondary">{trainer.email}</p>
                {trainer.phone && (
                  <p className="text-xs text-text-secondary">{trainer.phone}</p>
                )}
              </>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-text-muted">Status:</span>
            <Badge variant="outline" className={statusColor(invoice.status)}>
              {invoice.status}
            </Badge>
          </div>

          {/* Line Items Table */}
          {items.length > 0 ? (
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium text-center">Hours</th>
                  <th className="pb-3 font-medium text-right">Rate</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: InvoiceItem) => (
                  <tr key={item.id} className="border-b border-border/30">
                    <td className="py-2.5">
                      {new Date(item.session_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      })}
                    </td>
                    <td className="py-2.5">
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
                    <td className="py-2.5 text-center">
                      {Number(item.hours).toFixed(1)}
                    </td>
                    <td className="py-2.5 text-right">
                      {formatCents(item.rate_cents)}
                    </td>
                    <td className="py-2.5 text-right">
                      {formatCents(item.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-text-muted text-sm mb-6">No line items.</p>
          )}

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">
                Total Sessions
              </span>
              <span>{invoice.total_sessions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">
                Total Hours
              </span>
              <span>{Number(invoice.total_hours).toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
              <span>Total Due</span>
              <span>{formatCents(invoice.total_amount_cents)}</span>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="mt-8 pt-4 border-t border-border">
            <p className="text-xs text-text-muted">
              Payment Terms: Net 30
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

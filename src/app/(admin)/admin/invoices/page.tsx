"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCents } from "@/lib/utils/format"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  Printer,
  MoreVertical,
  CheckCircle,
  Send,
  Trash2,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import type { Profile, TrainerInvoice, InvoiceItem } from "@/types"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function AdminInvoicesPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [trainers, setTrainers] = useState<Profile[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>("all")
  const [invoices, setInvoices] = useState<TrainerInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TrainerInvoice | null>(null)

  const supabase = createClient()

  const loadTrainers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "trainer")
      .eq("trainer_type", "in_house")
      .order("last_name")
    setTrainers(data || [])
  }, [])

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("month", String(month))
    params.set("year", String(year))
    if (selectedTrainer !== "all") {
      params.set("trainerId", selectedTrainer)
    }

    const res = await fetch(`/api/trainer-invoices?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setInvoices(data)
    }
    setLoading(false)
  }, [month, year, selectedTrainer])

  useEffect(() => {
    loadTrainers()
  }, [loadTrainers])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const generateInvoice = async (trainerId: string) => {
    setGenerating(trainerId)
    try {
      const res = await fetch("/api/trainer-invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId, month, year }),
      })

      if (res.ok) {
        toast.success("Invoice generated successfully")
        loadInvoices()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to generate invoice")
      }
    } catch {
      toast.error("Failed to generate invoice")
    }
    setGenerating(null)
  }

  const updateStatus = async (invoiceId: string, status: "pending" | "invoiced" | "paid") => {
    const res = await fetch("/api/trainer-invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, status }),
    })

    if (res.ok) {
      toast.success(`Marked as ${status}`)
      loadInvoices()
    } else {
      toast.error("Failed to update status")
    }
  }

  const deleteInvoice = async () => {
    if (!deleteTarget) return

    const { error } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", deleteTarget.id)

    if (!error) {
      const { error: err2 } = await supabase
        .from("trainer_invoices")
        .delete()
        .eq("id", deleteTarget.id)

      if (!err2) {
        toast.success("Invoice deleted")
        loadInvoices()
      } else {
        toast.error("Failed to delete invoice")
      }
    } else {
      toast.error("Failed to delete invoice items")
    }
    setDeleteTarget(null)
  }

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else { setMonth(month - 1) }
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else { setMonth(month + 1) }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-success/10 text-success border-success/30"
      case "invoiced": return "bg-warning/10 text-warning border-warning/30"
      default: return "bg-text-muted/10 text-text-muted border-text-muted/30"
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Generate and manage trainer invoices"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm min-w-[140px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={selectedTrainer} onValueChange={(v) => v && setSelectedTrainer(v)}>
          <SelectTrigger className="bg-bg-secondary border-border w-[200px]">
            <SelectValue placeholder="All Trainers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trainers</SelectItem>
            {trainers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.first_name} {t.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTrainer !== "all" ? (
          <Button
            onClick={() => generateInvoice(selectedTrainer)}
            disabled={generating !== null}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            {generating === selectedTrainer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Invoice
          </Button>
        ) : (
          <Button
            onClick={async () => {
              for (const t of trainers) { await generateInvoice(t.id) }
            }}
            disabled={generating !== null || trainers.length === 0}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            {generating !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate All
          </Button>
        )}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <Card className="bg-bg-secondary border-border">
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary text-sm">
              No invoices for this period. Click &quot;Generate&quot; to create invoices.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const expanded = expandedId === invoice.id
            const items = invoice.items || []
            const trainer = invoice.trainer

            return (
              <Card key={invoice.id} className="bg-bg-secondary border-border">
                <CardContent className="py-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {trainer ? `${trainer.first_name} ${trainer.last_name}` : "Unknown"}
                      </p>
                      <p className="text-xs text-text-muted">{trainer?.email}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-bold">{invoice.total_sessions}</p>
                          <p className="text-xs text-text-muted">Sessions</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold">{Number(invoice.total_hours).toFixed(1)}</p>
                          <p className="text-xs text-text-muted">Hours</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-brand-orange">{formatCents(invoice.total_amount_cents)}</p>
                          <p className="text-xs text-text-muted">Total</p>
                        </div>
                      </div>

                      <Badge variant="outline" className={statusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>

                      {/* Actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-bg-secondary border-border">
                          <DropdownMenuItem
                            onClick={() => window.open(`/invoices/${invoice.id}`, "_blank")}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Printer className="h-4 w-4" />
                            View / Print
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {invoice.status === "pending" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(invoice.id, "invoiced")}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Send className="h-4 w-4" />
                              Mark Invoiced
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "paid" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(invoice.id, "paid")}
                              className="flex items-center gap-2 cursor-pointer text-success"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Mark Paid
                            </DropdownMenuItem>
                          )}
                          {invoice.status === "paid" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(invoice.id, "pending")}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Reset to Pending
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => generateInvoice(invoice.trainer_id)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Regenerate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(invoice)}
                            className="flex items-center gap-2 cursor-pointer text-error"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Expand */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setExpandedId(expanded ? null : invoice.id)}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Mobile stats */}
                  <div className="sm:hidden flex items-center gap-4 mt-3 text-sm">
                    <span>{invoice.total_sessions} sessions</span>
                    <span>{Number(invoice.total_hours).toFixed(1)}h</span>
                    <span className="text-brand-orange font-bold">{formatCents(invoice.total_amount_cents)}</span>
                  </div>

                  {/* Expanded line items */}
                  {expanded && items.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="overflow-x-auto">
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
                              <tr key={item.id} className="border-b border-border/20">
                                <td className="py-1.5">
                                  {new Date(item.session_date).toLocaleDateString("en-US", {
                                    weekday: "short", month: "short", day: "numeric",
                                    timeZone: "America/New_York",
                                  })}
                                </td>
                                <td className="py-1.5 font-mono">
                                  {new Date(item.start_time).toLocaleTimeString("en-US", {
                                    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
                                  })}
                                  {" - "}
                                  {new Date(item.end_time).toLocaleTimeString("en-US", {
                                    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
                                  })}
                                </td>
                                <td className="py-1.5 text-center">{Number(item.hours).toFixed(1)}</td>
                                <td className="py-1.5 text-right">{formatCents(item.rate_cents)}/hr</td>
                                <td className="py-1.5 text-right font-semibold">{formatCents(item.amount_cents)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border">
                              <td colSpan={4} className="py-2 text-right font-semibold">Total</td>
                              <td className="py-2 text-right font-bold text-brand-orange">
                                {formatCents(invoice.total_amount_cents)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {expanded && items.length === 0 && (
                    <p className="mt-4 text-xs text-text-muted text-center border-t border-border pt-4">
                      No line items — try regenerating this invoice.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Invoice?"
        description={`This will permanently delete the invoice for ${deleteTarget?.trainer?.first_name} ${deleteTarget?.trainer?.last_name} (${MONTHS[(deleteTarget?.month || 1) - 1]} ${deleteTarget?.year}). This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteInvoice}
        variant="destructive"
      />
    </div>
  )
}

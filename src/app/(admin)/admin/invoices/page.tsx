"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
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

  const updateStatus = async (invoiceId: string, status: "invoiced" | "paid") => {
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

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

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
        title="Invoices"
        description="Generate and manage trainer invoices"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Month selector */}
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

        {/* Trainer filter */}
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

        {/* Generate for selected or all */}
        {selectedTrainer !== "all" ? (
          <Button
            onClick={() => generateInvoice(selectedTrainer)}
            disabled={generating !== null}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            {generating === selectedTrainer && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate Invoice
          </Button>
        ) : (
          <Button
            onClick={async () => {
              for (const t of trainers) {
                await generateInvoice(t.id)
              }
            }}
            disabled={generating !== null || trainers.length === 0}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            {generating !== null && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate All
          </Button>
        )}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="pb-3 font-medium">Trainer</th>
                <th className="pb-3 font-medium text-center">Sessions</th>
                <th className="pb-3 font-medium text-center">Hours</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium text-center">Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const expanded = expandedId === invoice.id
                const items = invoice.items || []
                const trainer = invoice.trainer

                return (
                  <tr key={invoice.id} className="border-b border-border/50 align-top">
                    <td className="py-3" colSpan={6}>
                      {/* Main row */}
                      <div className="flex items-center">
                        <div className="flex-1">
                          <p className="font-semibold">
                            {trainer
                              ? `${trainer.first_name} ${trainer.last_name}`
                              : "Unknown"}
                          </p>
                          <p className="text-xs text-text-muted">
                            {trainer?.email}
                          </p>
                        </div>
                        <div className="w-20 text-center">
                          {invoice.total_sessions}
                        </div>
                        <div className="w-20 text-center">
                          {Number(invoice.total_hours).toFixed(1)}
                        </div>
                        <div className="w-28 text-right">
                          {formatCents(invoice.total_amount_cents)}
                        </div>
                        <div className="w-24 text-center">
                          <Badge
                            variant="outline"
                            className={statusColor(invoice.status)}
                          >
                            {invoice.status}
                          </Badge>
                        </div>
                        <div className="w-48 text-right">
                          <div className="flex justify-end gap-1">
                            <Link href={`/invoices/${invoice.id}`}>
                              <Button variant="ghost" size="sm" className="text-xs">
                                <Printer className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </Link>
                            {invoice.status !== "invoiced" &&
                              invoice.status !== "paid" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() =>
                                    updateStatus(invoice.id, "invoiced")
                                  }
                                >
                                  Mark Invoiced
                                </Button>
                              )}
                            {invoice.status !== "paid" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-green-400"
                                onClick={() =>
                                  updateStatus(invoice.id, "paid")
                                }
                              >
                                Mark Paid
                              </Button>
                            )}
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
                      </div>

                      {/* Expanded line items */}
                      {expanded && items.length > 0 && (
                        <div className="mt-3 ml-4 border-t border-border/30 pt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-text-muted text-left">
                                <th className="pb-2 font-medium">Date</th>
                                <th className="pb-2 font-medium">Time</th>
                                <th className="pb-2 font-medium text-center">
                                  Hours
                                </th>
                                <th className="pb-2 font-medium text-right">
                                  Rate
                                </th>
                                <th className="pb-2 font-medium text-right">
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item: InvoiceItem) => (
                                <tr
                                  key={item.id}
                                  className="border-b border-border/20"
                                >
                                  <td className="py-1.5">
                                    {new Date(
                                      item.session_date
                                    ).toLocaleDateString("en-US", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      timeZone: "America/New_York",
                                    })}
                                  </td>
                                  <td className="py-1.5">
                                    {new Date(
                                      item.start_time
                                    ).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      timeZone: "America/New_York",
                                    })}
                                    {" - "}
                                    {new Date(item.end_time).toLocaleTimeString(
                                      "en-US",
                                      {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        timeZone: "America/New_York",
                                      }
                                    )}
                                  </td>
                                  <td className="py-1.5 text-center">
                                    {Number(item.hours).toFixed(1)}
                                  </td>
                                  <td className="py-1.5 text-right">
                                    {formatCents(item.rate_cents)}
                                  </td>
                                  <td className="py-1.5 text-right">
                                    {formatCents(item.amount_cents)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

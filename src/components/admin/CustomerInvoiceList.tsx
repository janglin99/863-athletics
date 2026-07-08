"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { formatCents, formatDateTime } from "@/lib/utils/format"
import { formatInvoicePeriod, PERIOD_TYPE_LABELS } from "@/lib/utils/invoice"
import { toast } from "sonner"
import {
  MoreVertical,
  Eye,
  Download,
  DollarSign,
  CheckCircle,
  RefreshCw,
  Trash2,
  Loader2,
  FileText,
} from "lucide-react"
import type { CustomerInvoice } from "@/types"

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
  { value: "cash_app", label: "Cash App" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
]

interface Props {
  invoices: CustomerInvoice[]
  onChanged: () => void
  showCustomer?: boolean
  emptyMessage?: string
}

export function CustomerInvoiceList({
  invoices,
  onChanged,
  showCustomer,
  emptyMessage,
}: Props) {
  const [paymentTarget, setPaymentTarget] = useState<CustomerInvoice | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomerInvoice | null>(null)
  const [removingPaymentId, setRemovingPaymentId] = useState<string | null>(null)

  const resetPaymentForm = () => {
    setAmount("")
    setMethod("cash")
    setNote("")
  }

  const handleRecordPayment = async () => {
    if (!paymentTarget) return
    const cents = Math.round(parseFloat(amount) * 100)
    if (!cents || cents <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    setSaving(true)
    const res = await fetch(
      `/api/customer-invoices/${paymentTarget.id}/payments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          method,
          note: note || undefined,
        }),
      }
    )
    if (res.ok) {
      toast.success("Payment recorded")
      resetPaymentForm()
      setPaymentTarget(null)
      onChanged()
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to record payment")
    }
    setSaving(false)
  }

  const handleRemovePayment = async (invoiceId: string, paymentId: string) => {
    setRemovingPaymentId(paymentId)
    const res = await fetch(`/api/customer-invoices/${invoiceId}/payments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    })
    if (res.ok) {
      toast.success("Payment removed")
      setPaymentTarget(null)
      onChanged()
    } else {
      toast.error("Failed to remove payment")
    }
    setRemovingPaymentId(null)
  }

  const toggleStatus = async (invoice: CustomerInvoice) => {
    const nextStatus = invoice.status === "open" ? "closed" : "open"
    const res = await fetch("/api/customer-invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, status: nextStatus }),
    })
    if (res.ok) {
      toast.success(`Marked ${nextStatus}`)
      onChanged()
    } else {
      toast.error("Failed to update status")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await fetch("/api/customer-invoices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: deleteTarget.id }),
    })
    if (res.ok) {
      toast.success("Invoice deleted")
      setDeleteTarget(null)
      onChanged()
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to delete invoice")
    }
  }

  if (invoices.length === 0) {
    return (
      <Card className="bg-bg-secondary border-border">
        <CardContent className="py-8 text-center">
          <FileText className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-secondary text-sm">
            {emptyMessage || "No invoices yet."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {invoices.map((invoice) => {
          const balanceDue = invoice.total_cents - invoice.paid_cents
          return (
            <Card key={invoice.id} className="bg-bg-secondary border-border">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {showCustomer && (
                        <p className="font-semibold truncate">
                          {invoice.customer
                            ? `${invoice.customer.first_name} ${invoice.customer.last_name}`
                            : "Unknown customer"}
                        </p>
                      )}
                      <Badge
                        variant="outline"
                        className="bg-text-secondary/10 text-text-secondary border-text-secondary/30"
                      >
                        {invoice.invoice_number}
                      </Badge>
                      <span className="text-xs text-text-muted">
                        {PERIOD_TYPE_LABELS[invoice.period_type]}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          invoice.status === "closed"
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-warning/10 text-warning border-warning/30"
                        }
                      >
                        {invoice.status === "closed" ? "Closed" : "Open"}
                      </Badge>
                    </div>
                    {showCustomer && (
                      <p className="text-xs text-text-muted truncate">
                        {invoice.customer?.email}
                      </p>
                    )}
                    <p className="text-sm font-semibold mt-1">
                      {formatInvoicePeriod(invoice)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {formatCents(invoice.total_cents)}
                      </p>
                      {balanceDue > 0 ? (
                        <p className="text-xs text-warning">
                          {formatCents(balanceDue)} due
                        </p>
                      ) : (
                        <p className="text-xs text-success">Paid in full</p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-bg-secondary border-border">
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(`/api/customer-invoices/${invoice.id}/pdf`, "_blank")
                          }
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                          View / Print
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(`/api/customer-invoices/${invoice.id}/pdf?download=1`, "_blank")
                          }
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setPaymentTarget(invoice)
                            resetPaymentForm()
                          }}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <DollarSign className="h-4 w-4" />
                          Record Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleStatus(invoice)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          {invoice.status === "open" ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Mark Closed
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Reopen
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(invoice)}
                          className="flex items-center gap-2 cursor-pointer text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Record Payment Dialog */}
      <Dialog
        open={!!paymentTarget}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
      >
        <DialogContent className="bg-bg-secondary border-border">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide">
              Record Payment — {paymentTarget?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {paymentTarget && (
            <div className="space-y-4 pt-2">
              <div className="bg-bg-elevated rounded-lg border border-border p-3 flex items-center justify-between text-sm">
                <span className="text-text-secondary">Balance Due</span>
                <span className="font-display font-bold text-brand-orange">
                  {formatCents(
                    paymentTarget.total_cents - paymentTarget.paid_cents
                  )}
                </span>
              </div>

              {(paymentTarget.payments?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Payments Recorded</Label>
                  {paymentTarget.payments!.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-xs bg-bg-elevated rounded-md border border-border px-3 py-2"
                    >
                      <span className="text-text-secondary capitalize">
                        {formatDateTime(p.paid_at)} · {p.method.replace(/_/g, " ")}
                        {p.note && ` · ${p.note}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {formatCents(p.amount_cents)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemovePayment(paymentTarget.id, p.id)
                          }
                          disabled={removingPaymentId === p.id}
                          className="text-error hover:opacity-80"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-bg-elevated border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                    <SelectTrigger className="bg-bg-elevated border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Note <span className="text-text-muted">(optional)</span>
                </Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Check #1042"
                  className="bg-bg-elevated border-border"
                />
              </div>
              <Button
                onClick={handleRecordPayment}
                disabled={saving}
                className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Invoice"
        description={`This will permanently delete invoice ${deleteTarget?.invoice_number}. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  )
}

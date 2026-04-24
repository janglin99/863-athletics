"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatCents } from "@/lib/utils/format"
import { RefreshCw, Plus, Pencil, Trash2, Clock } from "lucide-react"
import { toast } from "sonner"

interface RescheduleFee {
  id: string
  name: string
  min_hours_before: number
  max_hours_before: number | null
  fee_cents: number
  is_active: boolean
  sort_order: number
  created_at: string
}

interface FeeFormData {
  name: string
  min_hours_before: string
  max_hours_before: string
  fee_dollars: string
  is_active: boolean
  sort_order: string
}

const DEFAULT_FORM: FeeFormData = {
  name: "",
  min_hours_before: "0",
  max_hours_before: "",
  fee_dollars: "0",
  is_active: true,
  sort_order: "0",
}

function feeToForm(fee: RescheduleFee): FeeFormData {
  return {
    name: fee.name,
    min_hours_before: fee.min_hours_before.toString(),
    max_hours_before: fee.max_hours_before?.toString() || "",
    fee_dollars: (fee.fee_cents / 100).toFixed(2),
    is_active: fee.is_active,
    sort_order: fee.sort_order.toString(),
  }
}

function formToPayload(form: FeeFormData) {
  return {
    name: form.name.trim(),
    min_hours_before: parseInt(form.min_hours_before) || 0,
    max_hours_before: form.max_hours_before
      ? parseInt(form.max_hours_before)
      : null,
    fee_cents: Math.round(parseFloat(form.fee_dollars || "0") * 100),
    is_active: form.is_active,
    sort_order: parseInt(form.sort_order) || 0,
  }
}

function formatTimeWindow(fee: RescheduleFee): string {
  if (fee.max_hours_before === null) {
    return `${fee.min_hours_before}+ hours`
  }
  return `${fee.min_hours_before}-${fee.max_hours_before} hours`
}

export default function AdminRescheduleFeesPage() {
  const [fees, setFees] = useState<RescheduleFee[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<RescheduleFee | null>(null)
  const [form, setForm] = useState<FeeFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [deleteFee, setDeleteFee] = useState<RescheduleFee | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadFees()
  }, [])

  async function loadFees() {
    const supabase = createClient()
    const { data } = await supabase
      .from("reschedule_fees")
      .select("*")
      .order("sort_order", { ascending: true })

    setFees(data || [])
    setLoading(false)
  }

  async function toggleActive(fee: RescheduleFee) {
    setToggling(fee.id)
    const supabase = createClient()
    const { data } = await supabase
      .from("reschedule_fees")
      .update({ is_active: !fee.is_active })
      .eq("id", fee.id)
      .select()
      .single()

    if (data) {
      setFees((prev) => prev.map((f) => (f.id === data.id ? data : f)))
    }
    setToggling(null)
  }

  function openCreate() {
    setEditingFee(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  function openEdit(fee: RescheduleFee) {
    setEditingFee(fee)
    setForm(feeToForm(fee))
    setDialogOpen(true)
  }

  function updateField(field: keyof FeeFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (isNaN(parseFloat(form.fee_dollars)) || parseFloat(form.fee_dollars) < 0) {
      toast.error("Valid fee amount is required")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const payload = formToPayload(form)

    if (editingFee) {
      const { data, error } = await supabase
        .from("reschedule_fees")
        .update(payload)
        .eq("id", editingFee.id)
        .select()
        .single()

      if (error) {
        toast.error("Failed to update tier: " + error.message)
        setSaving(false)
        return
      }
      setFees((prev) => prev.map((f) => (f.id === data.id ? data : f)))
      toast.success(`"${data.name}" updated`)
    } else {
      const { data, error } = await supabase
        .from("reschedule_fees")
        .insert(payload)
        .select()
        .single()

      if (error) {
        toast.error("Failed to create tier: " + error.message)
        setSaving(false)
        return
      }
      setFees((prev) =>
        [...prev, data].sort((a, b) => a.sort_order - b.sort_order)
      )
      toast.success(`"${data.name}" created`)
    }

    setSaving(false)
    setDialogOpen(false)
  }

  async function handleDelete() {
    if (!deleteFee) return
    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("reschedule_fees")
      .delete()
      .eq("id", deleteFee.id)

    if (error) {
      toast.error("Failed to delete tier: " + error.message)
      setDeleting(false)
      return
    }

    setFees((prev) => prev.filter((f) => f.id !== deleteFee.id))
    toast.success(`"${deleteFee.name}" deleted`)
    setDeleting(false)
    setDeleteFee(null)
  }

  return (
    <div>
      <PageHeader
        title="Reschedule Fees"
        description={`${fees.length} fee tier${fees.length !== 1 ? "s" : ""} configured`}
        action={
          <Button
            className="bg-brand-orange hover:bg-brand-orange/90 text-white"
            onClick={openCreate}
          >
            <Plus data-icon="inline-start" />
            Create Tier
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fees.map((fee) => (
            <Card
              key={fee.id}
              className={`bg-bg-secondary border-border transition-opacity ${
                !fee.is_active ? "opacity-50" : ""
              }`}
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-brand-orange/10">
                    <Clock className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(fee)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteFee(fee)}
                      className="text-text-muted hover:text-red-500"
                    >
                      <Trash2 />
                    </Button>
                    <Switch
                      checked={fee.is_active}
                      onCheckedChange={() => toggleActive(fee)}
                      disabled={toggling === fee.id}
                    />
                  </div>
                </div>
                <h3 className="font-display font-bold uppercase tracking-wide text-text-primary mb-1">
                  {fee.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-display font-bold text-brand-orange">
                    {fee.fee_cents === 0 ? "Free" : formatCents(fee.fee_cents)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-xs border-border"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {formatTimeWindow(fee)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs border-border"
                  >
                    Order: {fee.sort_order}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {fees.length === 0 && (
            <p className="text-text-secondary text-center py-8 col-span-full">
              No reschedule fee tiers configured
            </p>
          )}
        </div>
      )}

      {/* Create / Edit Fee Tier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-bg-secondary border-border sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide text-text-primary">
              {editingFee ? "Edit Fee Tier" : "Create Fee Tier"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="fee-name" className="text-text-secondary text-xs uppercase tracking-wide">
                Name *
              </Label>
              <Input
                id="fee-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. 24+ hours notice"
                className="bg-bg-elevated border-border text-text-primary"
              />
            </div>

            {/* Hours row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fee-min-hours" className="text-text-secondary text-xs uppercase tracking-wide">
                  Min Hours Before *
                </Label>
                <Input
                  id="fee-min-hours"
                  type="number"
                  min="0"
                  value={form.min_hours_before}
                  onChange={(e) => updateField("min_hours_before", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fee-max-hours" className="text-text-secondary text-xs uppercase tracking-wide">
                  Max Hours Before
                </Label>
                <Input
                  id="fee-max-hours"
                  type="number"
                  min="0"
                  value={form.max_hours_before}
                  onChange={(e) => updateField("max_hours_before", e.target.value)}
                  placeholder="Unlimited"
                  className="bg-bg-elevated border-border text-text-primary"
                />
                <p className="text-xs text-text-muted">
                  Leave empty for unlimited (e.g. 24+ hours)
                </p>
              </div>
            </div>

            {/* Fee */}
            <div className="grid gap-1.5">
              <Label htmlFor="fee-amount" className="text-text-secondary text-xs uppercase tracking-wide">
                Fee (USD) *
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                <Input
                  id="fee-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.fee_dollars}
                  onChange={(e) => updateField("fee_dollars", e.target.value)}
                  placeholder="0.00"
                  className="bg-bg-elevated border-border text-text-primary pl-7"
                />
              </div>
            </div>

            {/* Sort Order */}
            <div className="grid gap-1.5">
              <Label htmlFor="fee-sort" className="text-text-secondary text-xs uppercase tracking-wide">
                Sort Order
              </Label>
              <Input
                id="fee-sort"
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(e) => updateField("sort_order", e.target.value)}
                className="bg-bg-elevated border-border text-text-primary"
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-text-secondary text-xs uppercase tracking-wide">
                Active
              </Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => updateField("is_active", checked)}
              />
            </div>
          </div>

          <DialogFooter className="bg-bg-elevated border-border">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-border text-text-primary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white"
            >
              {saving ? "Saving..." : editingFee ? "Save Changes" : "Create Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteFee}
        onOpenChange={(open) => {
          if (!open) setDeleteFee(null)
        }}
        title="Delete Fee Tier"
        description={`Are you sure you want to delete "${deleteFee?.name}"? This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}

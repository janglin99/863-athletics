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
import { Textarea } from "@/components/ui/textarea"
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
  DialogFooter,
} from "@/components/ui/dialog"
import { formatCents } from "@/lib/utils/format"
import { DollarSign, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Rate } from "@/types"

const RATE_TYPES = [
  { value: "drop_in_1hr", label: "Drop-in (1hr)" },
  { value: "drop_in_multi", label: "Drop-in (Multi)" },
  { value: "day_pass", label: "Day Pass" },
  { value: "trainer_private", label: "Trainer (Private)" },
  { value: "trainer_group_small", label: "Trainer (Small Group)" },
  { value: "trainer_group_large", label: "Trainer (Large Group)" },
  { value: "membership_monthly", label: "Membership (Monthly)" },
  { value: "pack_5", label: "5-Pack" },
  { value: "pack_10", label: "10-Pack" },
  { value: "staff_access", label: "Staff Access" },
  { value: "event", label: "Event" },
]

const PER_UNIT_OPTIONS = [
  { value: "session", label: "Session" },
  { value: "hour", label: "Hour" },
  { value: "month", label: "Month" },
  { value: "person", label: "Person" },
]

interface RateFormData {
  name: string
  description: string
  type: string
  price: string
  per_unit: string
  min_hours: string
  max_hours: string
  min_people: string
  max_people: string
  advance_notice_hours: string
  cancellation_hours: string
  color_hex: string
  sort_order: string
  is_active: boolean
}

const DEFAULT_FORM: RateFormData = {
  name: "",
  description: "",
  type: "drop_in_1hr",
  price: "",
  per_unit: "session",
  min_hours: "",
  max_hours: "",
  min_people: "1",
  max_people: "1",
  advance_notice_hours: "1",
  cancellation_hours: "24",
  color_hex: "#FF4700",
  sort_order: "0",
  is_active: true,
}

function rateToForm(rate: Rate): RateFormData {
  return {
    name: rate.name,
    description: rate.description || "",
    type: rate.type,
    price: (rate.price_cents / 100).toFixed(2),
    per_unit: rate.per_unit,
    min_hours: rate.min_hours?.toString() || "",
    max_hours: rate.max_hours?.toString() || "",
    min_people: rate.min_people.toString(),
    max_people: rate.max_people.toString(),
    advance_notice_hours: rate.advance_notice_hours.toString(),
    cancellation_hours: rate.cancellation_hours.toString(),
    color_hex: rate.color_hex,
    sort_order: rate.sort_order.toString(),
    is_active: rate.is_active,
  }
}

function formToPayload(form: RateFormData) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    type: form.type,
    price_cents: Math.round(parseFloat(form.price) * 100),
    per_unit: form.per_unit,
    min_hours: form.min_hours ? parseFloat(form.min_hours) : null,
    max_hours: form.max_hours ? parseFloat(form.max_hours) : null,
    min_people: parseInt(form.min_people) || 1,
    max_people: parseInt(form.max_people) || 1,
    advance_notice_hours: parseInt(form.advance_notice_hours) || 1,
    cancellation_hours: parseInt(form.cancellation_hours) || 24,
    color_hex: form.color_hex,
    sort_order: parseInt(form.sort_order) || 0,
    is_active: form.is_active,
  }
}

export default function AdminRatesPage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<Rate | null>(null)
  const [form, setForm] = useState<RateFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [deleteRate, setDeleteRate] = useState<Rate | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadRates()
  }, [])

  async function loadRates() {
    const supabase = createClient()
    const { data } = await supabase
      .from("rates")
      .select("*")
      .order("sort_order", { ascending: true })

    setRates(data || [])
    setLoading(false)
  }

  async function toggleActive(rate: Rate) {
    setToggling(rate.id)
    const supabase = createClient()
    const { data } = await supabase
      .from("rates")
      .update({ is_active: !rate.is_active })
      .eq("id", rate.id)
      .select()
      .single()

    if (data) {
      setRates((prev) => prev.map((r) => (r.id === data.id ? data : r)))
    }
    setToggling(null)
  }

  function openCreate() {
    setEditingRate(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  function openEdit(rate: Rate) {
    setEditingRate(rate)
    setForm(rateToForm(rate))
    setDialogOpen(true)
  }

  function updateField(field: keyof RateFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      toast.error("Valid price is required")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const payload = formToPayload(form)

    if (editingRate) {
      const { data, error } = await supabase
        .from("rates")
        .update(payload)
        .eq("id", editingRate.id)
        .select()
        .single()

      if (error) {
        toast.error("Failed to update rate: " + error.message)
        setSaving(false)
        return
      }
      setRates((prev) => prev.map((r) => (r.id === data.id ? data : r)))
      toast.success(`"${data.name}" updated`)
    } else {
      const { data, error } = await supabase
        .from("rates")
        .insert(payload)
        .select()
        .single()

      if (error) {
        toast.error("Failed to create rate: " + error.message)
        setSaving(false)
        return
      }
      setRates((prev) =>
        [...prev, data].sort((a, b) => a.sort_order - b.sort_order)
      )
      toast.success(`"${data.name}" created`)
    }

    setSaving(false)
    setDialogOpen(false)
  }

  async function handleDelete() {
    if (!deleteRate) return
    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("rates")
      .delete()
      .eq("id", deleteRate.id)

    if (error) {
      toast.error("Failed to delete rate: " + error.message)
      setDeleting(false)
      return
    }

    setRates((prev) => prev.filter((r) => r.id !== deleteRate.id))
    toast.success(`"${deleteRate.name}" deleted`)
    setDeleting(false)
    setDeleteRate(null)
  }

  return (
    <div>
      <PageHeader
        title="Rates"
        description={`${rates.length} rate${rates.length !== 1 ? "s" : ""} configured`}
        action={
          <Button
            className="bg-brand-orange hover:bg-brand-orange/90 text-white"
            onClick={openCreate}
          >
            <Plus data-icon="inline-start" />
            Create Rate
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rates.map((rate) => (
            <Card
              key={rate.id}
              className={`bg-bg-secondary border-border transition-opacity ${
                !rate.is_active ? "opacity-50" : ""
              }`}
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: rate.color_hex + "20" }}
                  >
                    <DollarSign
                      className="h-5 w-5"
                      style={{ color: rate.color_hex }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(rate)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteRate(rate)}
                      className="text-text-muted hover:text-red-500"
                    >
                      <Trash2 />
                    </Button>
                    <Switch
                      checked={rate.is_active}
                      onCheckedChange={() => toggleActive(rate)}
                      disabled={toggling === rate.id}
                    />
                  </div>
                </div>
                <h3 className="font-display font-bold uppercase tracking-wide text-text-primary mb-1">
                  {rate.name}
                </h3>
                {rate.description && (
                  <p className="text-xs text-text-secondary mb-3 line-clamp-2">
                    {rate.description}
                  </p>
                )}
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-display font-bold text-brand-orange">
                    {formatCents(rate.price_cents)}
                  </span>
                  <span className="text-xs text-text-muted">
                    / {rate.per_unit}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-xs border-border capitalize"
                  >
                    {rate.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs border-border"
                  >
                    {rate.min_people}–{rate.max_people} people
                  </Badge>
                  {rate.min_hours && rate.max_hours && (
                    <Badge
                      variant="outline"
                      className="text-xs border-border"
                    >
                      {rate.min_hours}–{rate.max_hours}h
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {rates.length === 0 && (
            <p className="text-text-secondary text-center py-8 col-span-full">
              No rates configured
            </p>
          )}
        </div>
      )}

      {/* Create / Edit Rate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-bg-secondary border-border sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide text-text-primary">
              {editingRate ? "Edit Rate" : "Create Rate"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="rate-name" className="text-text-secondary text-xs uppercase tracking-wide">
                Name *
              </Label>
              <Input
                id="rate-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Drop-in (1 Hour)"
                className="bg-bg-elevated border-border text-text-primary"
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="rate-desc" className="text-text-secondary text-xs uppercase tracking-wide">
                Description
              </Label>
              <Textarea
                id="rate-desc"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Optional description"
                className="bg-bg-elevated border-border text-text-primary"
                rows={2}
              />
            </div>

            {/* Type & Per Unit row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-text-secondary text-xs uppercase tracking-wide">
                  Type
                </Label>
                <Select value={form.type} onValueChange={(val) => val && updateField("type", val)}>
                  <SelectTrigger className="w-full bg-bg-elevated border-border text-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-elevated border-border">
                    {RATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-text-primary">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-text-secondary text-xs uppercase tracking-wide">
                  Per Unit
                </Label>
                <Select value={form.per_unit} onValueChange={(val) => val && updateField("per_unit", val)}>
                  <SelectTrigger className="w-full bg-bg-elevated border-border text-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-elevated border-border">
                    {PER_UNIT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-text-primary">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price */}
            <div className="grid gap-1.5">
              <Label htmlFor="rate-price" className="text-text-secondary text-xs uppercase tracking-wide">
                Price (USD) *
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                <Input
                  id="rate-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => updateField("price", e.target.value)}
                  placeholder="0.00"
                  className="bg-bg-elevated border-border text-text-primary pl-7"
                />
              </div>
            </div>

            {/* Hours row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rate-min-hours" className="text-text-secondary text-xs uppercase tracking-wide">
                  Min Hours
                </Label>
                <Input
                  id="rate-min-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.min_hours}
                  onChange={(e) => updateField("min_hours", e.target.value)}
                  placeholder="—"
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rate-max-hours" className="text-text-secondary text-xs uppercase tracking-wide">
                  Max Hours
                </Label>
                <Input
                  id="rate-max-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.max_hours}
                  onChange={(e) => updateField("max_hours", e.target.value)}
                  placeholder="—"
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
            </div>

            {/* People row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rate-min-people" className="text-text-secondary text-xs uppercase tracking-wide">
                  Min People
                </Label>
                <Input
                  id="rate-min-people"
                  type="number"
                  min="1"
                  value={form.min_people}
                  onChange={(e) => updateField("min_people", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rate-max-people" className="text-text-secondary text-xs uppercase tracking-wide">
                  Max People
                </Label>
                <Input
                  id="rate-max-people"
                  type="number"
                  min="1"
                  value={form.max_people}
                  onChange={(e) => updateField("max_people", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
            </div>

            {/* Notice & Cancellation row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rate-notice" className="text-text-secondary text-xs uppercase tracking-wide">
                  Advance Notice (hrs)
                </Label>
                <Input
                  id="rate-notice"
                  type="number"
                  min="0"
                  value={form.advance_notice_hours}
                  onChange={(e) => updateField("advance_notice_hours", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rate-cancel" className="text-text-secondary text-xs uppercase tracking-wide">
                  Cancellation (hrs)
                </Label>
                <Input
                  id="rate-cancel"
                  type="number"
                  min="0"
                  value={form.cancellation_hours}
                  onChange={(e) => updateField("cancellation_hours", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
            </div>

            {/* Color & Sort Order row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rate-color" className="text-text-secondary text-xs uppercase tracking-wide">
                  Color
                </Label>
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-lg border border-border shrink-0"
                    style={{ backgroundColor: form.color_hex }}
                  />
                  <Input
                    id="rate-color"
                    value={form.color_hex}
                    onChange={(e) => updateField("color_hex", e.target.value)}
                    placeholder="#FF4700"
                    className="bg-bg-elevated border-border text-text-primary"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rate-sort" className="text-text-secondary text-xs uppercase tracking-wide">
                  Sort Order
                </Label>
                <Input
                  id="rate-sort"
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={(e) => updateField("sort_order", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
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
              {saving ? "Saving..." : editingRate ? "Save Changes" : "Create Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteRate}
        onOpenChange={(open) => {
          if (!open) setDeleteRate(null)
        }}
        title="Delete Rate"
        description={`Are you sure you want to delete "${deleteRate?.name}"? This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}

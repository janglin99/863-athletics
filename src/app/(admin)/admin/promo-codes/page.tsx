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
import { Tag, Plus, Pencil, Trash2, Percent, DollarSign, Clock } from "lucide-react"
import { toast } from "sonner"

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

const DISCOUNT_TYPES = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed_amount", label: "Fixed Amount" },
  { value: "fixed_rate_per_hour", label: "Fixed Rate Per Hour" },
]

interface PromoCode {
  id: string
  code: string
  description: string | null
  discount_type: "percentage" | "fixed_amount" | "fixed_rate_per_hour"
  discount_value: number
  min_booking_cents: number
  max_discount_cents: number | null
  usage_limit: number | null
  usage_count: number
  valid_from: string | null
  valid_until: string | null
  applicable_rate_types: string[] | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

interface PromoFormData {
  code: string
  description: string
  discount_type: string
  discount_value: string
  min_booking_dollars: string
  max_discount_dollars: string
  usage_limit: string
  valid_from: string
  valid_until: string
  applicable_rate_types: string[]
  is_active: boolean
}

const DEFAULT_FORM: PromoFormData = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_booking_dollars: "0",
  max_discount_dollars: "",
  usage_limit: "",
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: "",
  applicable_rate_types: [],
  is_active: true,
}

function promoToForm(promo: PromoCode): PromoFormData {
  return {
    code: promo.code,
    description: promo.description || "",
    discount_type: promo.discount_type,
    discount_value:
      promo.discount_type === "percentage"
        ? promo.discount_value.toString()
        : (promo.discount_value / 100).toFixed(2),
    min_booking_dollars: (promo.min_booking_cents / 100).toFixed(2),
    max_discount_dollars: promo.max_discount_cents
      ? (promo.max_discount_cents / 100).toFixed(2)
      : "",
    usage_limit: promo.usage_limit?.toString() || "",
    valid_from: promo.valid_from
      ? new Date(promo.valid_from).toISOString().slice(0, 10)
      : "",
    valid_until: promo.valid_until
      ? new Date(promo.valid_until).toISOString().slice(0, 10)
      : "",
    applicable_rate_types: promo.applicable_rate_types || [],
    is_active: promo.is_active,
  }
}

function formToPayload(form: PromoFormData) {
  const isPercentage = form.discount_type === "percentage"
  return {
    code: form.code.trim().toUpperCase(),
    description: form.description.trim() || null,
    discount_type: form.discount_type,
    discount_value: isPercentage
      ? parseInt(form.discount_value)
      : Math.round(parseFloat(form.discount_value) * 100),
    min_booking_cents: Math.round(parseFloat(form.min_booking_dollars || "0") * 100),
    max_discount_cents: form.max_discount_dollars
      ? Math.round(parseFloat(form.max_discount_dollars) * 100)
      : null,
    usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
    valid_from: form.valid_from
      ? new Date(form.valid_from).toISOString()
      : null,
    valid_until: form.valid_until
      ? new Date(form.valid_until + "T23:59:59").toISOString()
      : null,
    applicable_rate_types:
      form.applicable_rate_types.length > 0
        ? form.applicable_rate_types
        : null,
    is_active: form.is_active,
  }
}

function formatDiscountValue(promo: PromoCode): string {
  switch (promo.discount_type) {
    case "percentage":
      return `${promo.discount_value}% off`
    case "fixed_amount":
      return `${formatCents(promo.discount_value)} off`
    case "fixed_rate_per_hour":
      return `${formatCents(promo.discount_value)}/hr flat`
    default:
      return String(promo.discount_value)
  }
}

function discountTypeIcon(type: string) {
  switch (type) {
    case "percentage":
      return Percent
    case "fixed_amount":
      return DollarSign
    case "fixed_rate_per_hour":
      return Clock
    default:
      return Tag
  }
}

export default function AdminPromoCodesPage() {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null)
  const [form, setForm] = useState<PromoFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [deletePromo, setDeletePromo] = useState<PromoCode | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadPromos()
  }, [])

  async function loadPromos() {
    const supabase = createClient()
    const { data } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false })

    setPromos(data || [])
    setLoading(false)
  }

  async function toggleActive(promo: PromoCode) {
    setToggling(promo.id)
    const supabase = createClient()
    const { data } = await supabase
      .from("promo_codes")
      .update({ is_active: !promo.is_active })
      .eq("id", promo.id)
      .select()
      .single()

    if (data) {
      setPromos((prev) => prev.map((p) => (p.id === data.id ? data : p)))
    }
    setToggling(null)
  }

  function openCreate() {
    setEditingPromo(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  function openEdit(promo: PromoCode) {
    setEditingPromo(promo)
    setForm(promoToForm(promo))
    setDialogOpen(true)
  }

  function updateField(field: keyof PromoFormData, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleRateType(rateType: string) {
    setForm((prev) => {
      const current = prev.applicable_rate_types
      const next = current.includes(rateType)
        ? current.filter((t) => t !== rateType)
        : [...current, rateType]
      return { ...prev, applicable_rate_types: next }
    })
  }

  async function handleSave() {
    if (!form.code.trim()) {
      toast.error("Code is required")
      return
    }
    if (
      !form.discount_value ||
      isNaN(parseFloat(form.discount_value)) ||
      parseFloat(form.discount_value) <= 0
    ) {
      toast.error("Valid discount value is required")
      return
    }
    if (
      form.discount_type === "percentage" &&
      parseInt(form.discount_value) > 100
    ) {
      toast.error("Percentage cannot exceed 100%")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const payload = formToPayload(form)

    if (editingPromo) {
      const { data, error } = await supabase
        .from("promo_codes")
        .update(payload)
        .eq("id", editingPromo.id)
        .select()
        .single()

      if (error) {
        toast.error("Failed to update promo code: " + error.message)
        setSaving(false)
        return
      }
      setPromos((prev) => prev.map((p) => (p.id === data.id ? data : p)))
      toast.success(`"${data.code}" updated`)
    } else {
      const { data, error } = await supabase
        .from("promo_codes")
        .insert(payload)
        .select()
        .single()

      if (error) {
        toast.error("Failed to create promo code: " + error.message)
        setSaving(false)
        return
      }
      setPromos((prev) => [data, ...prev])
      toast.success(`"${data.code}" created`)
    }

    setSaving(false)
    setDialogOpen(false)
  }

  async function handleDelete() {
    if (!deletePromo) return
    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("promo_codes")
      .delete()
      .eq("id", deletePromo.id)

    if (error) {
      toast.error("Failed to delete promo code: " + error.message)
      setDeleting(false)
      return
    }

    setPromos((prev) => prev.filter((p) => p.id !== deletePromo.id))
    toast.success(`"${deletePromo.code}" deleted`)
    setDeleting(false)
    setDeletePromo(null)
  }

  return (
    <div>
      <PageHeader
        title="Promo Codes"
        description={`${promos.length} promo code${promos.length !== 1 ? "s" : ""}`}
        action={
          <Button
            className="bg-brand-orange hover:bg-brand-orange/90 text-white"
            onClick={openCreate}
          >
            <Plus data-icon="inline-start" />
            Create Code
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((promo) => {
            const Icon = discountTypeIcon(promo.discount_type)
            return (
              <Card
                key={promo.id}
                className={`bg-bg-secondary border-border transition-opacity ${
                  !promo.is_active ? "opacity-50" : ""
                }`}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-brand-orange/10">
                      <Icon className="h-5 w-5 text-brand-orange" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEdit(promo)}
                        className="text-text-muted hover:text-text-primary"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeletePromo(promo)}
                        className="text-text-muted hover:text-red-500"
                      >
                        <Trash2 />
                      </Button>
                      <Switch
                        checked={promo.is_active}
                        onCheckedChange={() => toggleActive(promo)}
                        disabled={toggling === promo.id}
                      />
                    </div>
                  </div>

                  <h3 className="font-mono text-lg font-bold uppercase tracking-wide text-text-primary mb-1">
                    {promo.code}
                  </h3>
                  {promo.description && (
                    <p className="text-xs text-text-secondary mb-3 line-clamp-2">
                      {promo.description}
                    </p>
                  )}

                  <div className="text-2xl font-display font-bold text-brand-orange mb-3">
                    {formatDiscountValue(promo)}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className="text-xs border-border"
                    >
                      {promo.usage_count}
                      {promo.usage_limit !== null
                        ? ` / ${promo.usage_limit}`
                        : ""}{" "}
                      uses
                    </Badge>
                    {promo.valid_from && (
                      <Badge
                        variant="outline"
                        className="text-xs border-border"
                      >
                        From{" "}
                        {new Date(promo.valid_from).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </Badge>
                    )}
                    {promo.valid_until && (
                      <Badge
                        variant="outline"
                        className="text-xs border-border"
                      >
                        Until{" "}
                        {new Date(promo.valid_until).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </Badge>
                    )}
                    {promo.applicable_rate_types &&
                      promo.applicable_rate_types.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs border-border"
                        >
                          {promo.applicable_rate_types.length} rate type
                          {promo.applicable_rate_types.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    {promo.min_booking_cents > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs border-border"
                      >
                        Min {formatCents(promo.min_booking_cents)}
                      </Badge>
                    )}
                    {promo.max_discount_cents && (
                      <Badge
                        variant="outline"
                        className="text-xs border-border"
                      >
                        Max {formatCents(promo.max_discount_cents)} off
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {promos.length === 0 && (
            <p className="text-text-secondary text-center py-8 col-span-full">
              No promo codes yet
            </p>
          )}
        </div>
      )}

      {/* Create / Edit Promo Code Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-bg-secondary border-border sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide text-text-primary">
              {editingPromo ? "Edit Promo Code" : "Create Promo Code"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Code */}
            <div className="grid gap-1.5">
              <Label
                htmlFor="promo-code"
                className="text-text-secondary text-xs uppercase tracking-wide"
              >
                Code *
              </Label>
              <Input
                id="promo-code"
                value={form.code}
                onChange={(e) =>
                  updateField("code", e.target.value.toUpperCase())
                }
                placeholder="e.g. SUMMER20"
                className="bg-bg-elevated border-border text-text-primary font-mono uppercase"
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label
                htmlFor="promo-desc"
                className="text-text-secondary text-xs uppercase tracking-wide"
              >
                Description
              </Label>
              <Textarea
                id="promo-desc"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Optional description"
                className="bg-bg-elevated border-border text-text-primary"
                rows={2}
              />
            </div>

            {/* Discount Type & Value row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-text-secondary text-xs uppercase tracking-wide">
                  Discount Type
                </Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(val) => val && updateField("discount_type", val)}
                >
                  <SelectTrigger className="w-full bg-bg-elevated border-border text-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-elevated border-border">
                    {DISCOUNT_TYPES.map((t) => (
                      <SelectItem
                        key={t.value}
                        value={t.value}
                        className="text-text-primary"
                      >
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label
                  htmlFor="promo-value"
                  className="text-text-secondary text-xs uppercase tracking-wide"
                >
                  {form.discount_type === "percentage"
                    ? "Value (%)"
                    : "Value ($)"}
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    {form.discount_type === "percentage" ? "%" : "$"}
                  </span>
                  <Input
                    id="promo-value"
                    type="number"
                    step={form.discount_type === "percentage" ? "1" : "0.01"}
                    min="0"
                    max={form.discount_type === "percentage" ? "100" : undefined}
                    value={form.discount_value}
                    onChange={(e) =>
                      updateField("discount_value", e.target.value)
                    }
                    placeholder="0"
                    className="bg-bg-elevated border-border text-text-primary pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Min Booking & Max Discount row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="promo-min"
                  className="text-text-secondary text-xs uppercase tracking-wide"
                >
                  Min Booking ($)
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    $
                  </span>
                  <Input
                    id="promo-min"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.min_booking_dollars}
                    onChange={(e) =>
                      updateField("min_booking_dollars", e.target.value)
                    }
                    placeholder="0.00"
                    className="bg-bg-elevated border-border text-text-primary pl-7"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label
                  htmlFor="promo-max"
                  className="text-text-secondary text-xs uppercase tracking-wide"
                >
                  Max Discount ($)
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    $
                  </span>
                  <Input
                    id="promo-max"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.max_discount_dollars}
                    onChange={(e) =>
                      updateField("max_discount_dollars", e.target.value)
                    }
                    placeholder="No cap"
                    className="bg-bg-elevated border-border text-text-primary pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Usage Limit */}
            <div className="grid gap-1.5">
              <Label
                htmlFor="promo-limit"
                className="text-text-secondary text-xs uppercase tracking-wide"
              >
                Usage Limit
              </Label>
              <Input
                id="promo-limit"
                type="number"
                min="0"
                value={form.usage_limit}
                onChange={(e) => updateField("usage_limit", e.target.value)}
                placeholder="Unlimited"
                className="bg-bg-elevated border-border text-text-primary"
              />
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="promo-from"
                  className="text-text-secondary text-xs uppercase tracking-wide"
                >
                  Valid From
                </Label>
                <Input
                  id="promo-from"
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => updateField("valid_from", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="promo-until"
                  className="text-text-secondary text-xs uppercase tracking-wide"
                >
                  Valid Until
                </Label>
                <Input
                  id="promo-until"
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => updateField("valid_until", e.target.value)}
                  className="bg-bg-elevated border-border text-text-primary"
                />
              </div>
            </div>

            {/* Applicable Rate Types */}
            <div className="grid gap-1.5">
              <Label className="text-text-secondary text-xs uppercase tracking-wide">
                Applicable Rate Types
              </Label>
              <p className="text-xs text-text-muted">
                Leave all unchecked to apply to all rate types.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {RATE_TYPES.map((rt) => (
                  <label
                    key={rt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.applicable_rate_types.includes(rt.value)}
                      onChange={() => toggleRateType(rt.value)}
                      className="rounded border-border bg-bg-elevated text-brand-orange focus:ring-brand-orange"
                    />
                    <span className="text-sm text-text-primary">
                      {rt.label}
                    </span>
                  </label>
                ))}
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
              {saving
                ? "Saving..."
                : editingPromo
                  ? "Save Changes"
                  : "Create Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletePromo}
        onOpenChange={(open) => {
          if (!open) setDeletePromo(null)
        }}
        title="Delete Promo Code"
        description={`Are you sure you want to delete "${deletePromo?.code}"? This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}

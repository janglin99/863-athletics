"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_PICKUP_ADDRESS_LENGTH,
  MAX_SIZES,
  SIZE_CODE_PATTERN,
} from "@/lib/shop/products"
import { toast } from "sonner"
import { ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react"
import type { ShopConfig } from "@/lib/shop/config"

// Inputs hold dollar strings; converted to/from cents at the edges.
const toDollars = (cents: number) => (cents / 100).toFixed(2)
const toCents = (dollars: string) => Math.round(parseFloat(dollars) * 100)

interface Row {
  code: string
  label: string
  price: string
  soldOut: boolean
}

export default function AdminShopPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [description, setDescription] = useState("")
  const [shipping, setShipping] = useState("")
  const [shippingEnabled, setShippingEnabled] = useState(true)
  const [pickupEnabled, setPickupEnabled] = useState(false)
  const [pickupAddress, setPickupAddress] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  function load(config: ShopConfig) {
    setRows(
      config.sizes.map((s) => ({
        code: s.code,
        label: s.label,
        price: toDollars(s.priceCents),
        soldOut: s.soldOut,
      }))
    )
    setDescription(config.description)
    setShipping(toDollars(config.shippingCents))
    setShippingEnabled(config.shippingEnabled)
    setPickupEnabled(config.pickupEnabled)
    setPickupAddress(config.pickupAddress)
  }

  useEffect(() => {
    async function fetchConfig() {
      const res = await fetch("/api/admin/shop")
      if (res.ok) load(await res.json())
      else toast.error("Failed to load shop settings")
      setLoading(false)
    }
    fetchConfig()
  }, [])

  // Rows are keyed by position, since the size code itself is editable.
  const update = (index: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const remove = (index: number) =>
    setRows((rs) => rs.filter((_, i) => i !== index))
  const add = () =>
    setRows((rs) => [
      ...rs,
      { code: "", label: "", price: rs.at(-1)?.price ?? "30.00", soldOut: false },
    ])

  async function save() {
    const sizes = rows.map((r) => ({
      code: r.code.trim(),
      label: r.label.trim(),
      priceCents: toCents(r.price),
      soldOut: r.soldOut,
    }))
    const codes = sizes.map((s) => s.code.toLowerCase())
    if (!description.trim()) {
      toast.error("Enter a product description")
      return
    }
    if (sizes.length === 0) {
      toast.error("Add at least one size")
      return
    }
    if (sizes.some((s) => !SIZE_CODE_PATTERN.test(s.code))) {
      toast.error("Every size needs a short code, like S, XL or Youth M")
      return
    }
    if (new Set(codes).size !== codes.length) {
      toast.error("Each size code must be unique")
      return
    }
    const shippingCents = toCents(shipping)
    if (
      sizes.some((s) => !Number.isFinite(s.priceCents) || s.priceCents < 100) ||
      !Number.isFinite(shippingCents) ||
      shippingCents < 0
    ) {
      toast.error("Enter valid prices (minimum $1.00) and shipping amount")
      return
    }

    if (!shippingEnabled && !pickupEnabled) {
      toast.error("Enable shipping, pickup, or both")
      return
    }
    if (pickupEnabled && !pickupAddress.trim()) {
      toast.error("Enter a pickup address")
      return
    }

    setSaving(true)
    const res = await fetch("/api/admin/shop", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        sizes,
        shippingCents,
        shippingEnabled,
        pickupEnabled,
        pickupAddress,
      }),
    })
    if (res.ok) {
      load(await res.json())
      toast.success("Shop updated — changes are live")
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Failed to save")
    }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader
        title="Shop"
        description="Respect Da City Cuh Tee — prices, shipping and availability"
        action={
          <Link
            href="/shop"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-brand-orange hover:underline"
          >
            View shop <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="max-w-2xl space-y-8">
          <div className="bg-bg-secondary rounded-lg border border-border p-6 space-y-3">
            <h3 className="font-display font-bold uppercase tracking-wide">
              Description
            </h3>
            <p className="text-sm text-text-secondary">
              The text under the price on the shop page. Line breaks are kept.
            </p>
            <Textarea
              aria-label="Product description"
              rows={4}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-bg-elevated border-border"
            />
            <p className="text-xs text-text-muted text-right">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>

          <div className="bg-bg-secondary rounded-lg border border-border p-6 space-y-4">
            <h3 className="font-display font-bold uppercase tracking-wide">
              Sizes
            </h3>
            <p className="text-sm text-text-secondary">
              Sizes appear on the shop page in this order. The code is the short
              text on the button (S, XL, Youth M); the name is the longer
              description shown once selected.
            </p>
            <div className="divide-y divide-border">
              <div className="hidden sm:grid grid-cols-[5.5rem_1fr_8rem_4.5rem_2rem] gap-3 pb-2 text-xs uppercase tracking-wide text-text-muted">
                <span>Code</span>
                <span>Name</span>
                <span>Price (USD)</span>
                <span>Sold out</span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[5.5rem_1fr] sm:grid-cols-[5.5rem_1fr_8rem_4.5rem_2rem] items-center gap-3 py-3"
                >
                  <Input
                    aria-label={`Size ${i + 1} code`}
                    placeholder="XL"
                    maxLength={12}
                    value={r.code}
                    onChange={(e) => update(i, { code: e.target.value })}
                    className="bg-bg-elevated border-border"
                  />
                  <Input
                    aria-label={`Size ${i + 1} name`}
                    placeholder="X-Large"
                    maxLength={40}
                    value={r.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    className="bg-bg-elevated border-border"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                      $
                    </span>
                    <Input
                      aria-label={`Size ${i + 1} price`}
                      type="number"
                      min={1}
                      step="0.01"
                      value={r.price}
                      onChange={(e) => update(i, { price: e.target.value })}
                      className="bg-bg-elevated border-border pl-7"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <Switch
                      aria-label={`Size ${i + 1} sold out`}
                      checked={r.soldOut}
                      onCheckedChange={(v) => update(i, { soldOut: v })}
                    />
                    <span className="sm:hidden">Sold out</span>
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove size ${r.code || i + 1}`}
                    onClick={() => remove(i)}
                    className="text-text-muted hover:text-red-400 justify-self-end"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={add}
              disabled={rows.length >= MAX_SIZES}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add size
            </Button>
          </div>

          <div className="bg-bg-secondary rounded-lg border border-border p-6 space-y-5">
            <div>
              <h3 className="font-display font-bold uppercase tracking-wide">
                Delivery
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Turn on shipping, local pickup, or both. With both on,
                customers choose at checkout. For pickup only, switch shipping
                off.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="shippingEnabled">Offer shipping (U.S.)</Label>
              <Switch
                id="shippingEnabled"
                checked={shippingEnabled}
                onCheckedChange={setShippingEnabled}
              />
            </div>

            {shippingEnabled && (
              <div className="space-y-2 max-w-[9rem]">
                <Label htmlFor="shipping">Shipping rate (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    $
                  </span>
                  <Input
                    id="shipping"
                    type="number"
                    min={0}
                    step="0.01"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    className="bg-bg-elevated border-border pl-7"
                  />
                </div>
                <p className="text-xs text-text-muted">Flat per order. 0.00 = free.</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
              <Label htmlFor="pickupEnabled">Offer local pickup</Label>
              <Switch
                id="pickupEnabled"
                checked={pickupEnabled}
                onCheckedChange={setPickupEnabled}
              />
            </div>

            {pickupEnabled && (
              <div className="space-y-2">
                <Label htmlFor="pickupAddress">Pickup address</Label>
                <Textarea
                  id="pickupAddress"
                  rows={4}
                  maxLength={MAX_PICKUP_ADDRESS_LENGTH}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  className="bg-bg-elevated border-border"
                />
                <p className="text-xs text-text-muted">
                  Shown to customers on the shop page, at Stripe checkout, and
                  in their confirmation email. Add pickup hours here if you
                  like.
                </p>
              </div>
            )}

            {!shippingEnabled && !pickupEnabled && (
              <p className="text-sm text-red-400">
                Enable at least one delivery option.
              </p>
            )}
          </div>

          <Button
            onClick={save}
            disabled={saving}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      )}
    </div>
  )
}

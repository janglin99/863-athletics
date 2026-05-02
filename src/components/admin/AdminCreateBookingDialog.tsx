"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { TimeSlotGrid } from "@/components/booking/TimeSlotGrid"
import { formatCents } from "@/lib/utils/format"
import { format, addDays } from "date-fns"
import { toast } from "sonner"
import { Loader2, Plus, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Profile, Rate, AvailabilityMap, TimeSlot } from "@/types"

type PaymentAction = "mark_paid" | "comp" | "send_request"

const PAYMENT_METHODS = [
  { value: "stripe_card", label: "Stripe / Card" },
  { value: "zelle", label: "Zelle" },
  { value: "cash_app", label: "Cash App" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

interface Props {
  onCreated?: () => void
  // Controlled mode (for triggering from elsewhere, e.g. calendar cell click)
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  initialDate?: Date
  initialSlots?: { start: string; end: string }[]
}

export function AdminCreateBookingDialog({
  onCreated,
  open: openProp,
  onOpenChange,
  hideTrigger,
  initialDate,
  initialSlots,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const [submitting, setSubmitting] = useState(false)

  // Data
  const [customers, setCustomers] = useState<Profile[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [availability, setAvailability] = useState<AvailabilityMap>({})
  const [loadingAvailability, setLoadingAvailability] = useState(false)

  // Form state
  const [customerId, setCustomerId] = useState<string>("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerListOpen, setCustomerListOpen] = useState(false)
  const [rateId, setRateId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedSlots, setSelectedSlots] = useState<
    { start: string; end: string }[]
  >([])
  const [participantCount, setParticipantCount] = useState(1)
  const [notes, setNotes] = useState("")
  const [overrideFee, setOverrideFee] = useState<string>("") // dollars, blank = no override
  const [paymentAction, setPaymentAction] = useState<PaymentAction>("mark_paid")
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [notify, setNotify] = useState(true)
  const [compMode, setCompMode] = useState(false)

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const selectedRate = rates.find((r) => r.id === rateId)

  // Load customers + rates when dialog opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [{ data: profiles }, { data: rateRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, phone, role")
          .order("first_name", { ascending: true })
          .limit(500),
        supabase
          .from("rates")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
      ])
      if (cancelled) return
      setCustomers((profiles as Profile[]) || [])
      setRates(rateRows || [])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open])

  // Fetch availability when date is picked
  const fetchAvailability = useCallback(async () => {
    setLoadingAvailability(true)
    const start = new Date().toISOString()
    const end = addDays(new Date(), 90).toISOString()
    const res = await fetch(`/api/availability?start=${start}&end=${end}`)
    const data = await res.json()
    setAvailability(data.availability || {})
    setLoadingAvailability(false)
  }, [])

  useEffect(() => {
    if (!open) return
    async function run() {
      await fetchAvailability()
    }
    run()
  }, [open, fetchAvailability])

  // Apply initial date/slots when opened from outside (e.g. calendar cell click)
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      if (initialDate) setSelectedDate(initialDate)
      if (initialSlots && initialSlots.length > 0) {
        setSelectedSlots(initialSlots)
      }
    })
  }, [open, initialDate, initialSlots])

  const dateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null
  const daySlots: TimeSlot[] = dateKey
    ? availability[dateKey]?.slots || []
    : []

  const totalHours = useMemo(
    () =>
      selectedSlots.reduce(
        (ms, s) =>
          ms + (new Date(s.end).getTime() - new Date(s.start).getTime()),
        0
      ) /
      (1000 * 60 * 60),
    [selectedSlots]
  )

  const calculatedCents = useMemo(() => {
    if (!selectedRate || selectedSlots.length === 0) return 0
    if (selectedRate.per_unit === "hour") {
      return Math.round(selectedRate.price_cents * totalHours)
    }
    if (selectedRate.per_unit === "person") {
      return Math.round(
        selectedRate.price_cents * participantCount * totalHours
      )
    }
    return selectedRate.price_cents
  }, [selectedRate, selectedSlots, totalHours, participantCount])

  const overrideCents = overrideFee
    ? Math.round(parseFloat(overrideFee) * 100)
    : null
  const finalCents =
    paymentAction === "comp"
      ? overrideCents ?? 0
      : overrideCents ?? calculatedCents

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch) return true
    const q = customerSearch.toLowerCase()
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  })

  const reset = () => {
    setCustomerId("")
    setCustomerSearch("")
    setRateId("")
    setSelectedDate(undefined)
    setSelectedSlots([])
    setParticipantCount(1)
    setNotes("")
    setOverrideFee("")
    setPaymentAction("mark_paid")
    setPaymentMethod("cash")
    setNotify(true)
    setCompMode(false)
  }

  // For comp-session mode we still need a valid rate_id (the API requires
  // one). Prefer a rate that looks like a "Comp" placeholder, else fall back
  // to the first active rate; price gets zeroed via overrideTotalCents.
  const compFallbackRateId = useMemo(() => {
    const compRate = rates.find(
      (r) =>
        r.name.toLowerCase().includes("comp") ||
        r.type.toLowerCase().includes("comp")
    )
    return compRate?.id || rates[0]?.id || ""
  }, [rates])

  const handleSubmit = async () => {
    if (!customerId) return toast.error("Select a customer")
    const effectiveRateId = compMode ? compFallbackRateId : rateId
    if (!effectiveRateId) {
      return toast.error(
        compMode
          ? "No rates configured — add a rate before creating comp sessions"
          : "Select a rate"
      )
    }
    if (selectedSlots.length === 0) return toast.error("Select time slots")

    setSubmitting(true)
    const effectivePaymentAction: PaymentAction = compMode
      ? "comp"
      : paymentAction
    const payload: Record<string, unknown> = {
      customerId,
      rateId: effectiveRateId,
      slots: selectedSlots,
      participantCount,
      notes: notes || undefined,
      paymentAction: effectivePaymentAction,
      notify,
    }
    if (effectivePaymentAction === "mark_paid")
      payload.paymentMethod = paymentMethod
    if (effectivePaymentAction === "comp") {
      payload.overrideTotalCents = compMode ? 0 : overrideCents ?? 0
      payload.internalNotes = compMode
        ? "Quick comp session — no rate selected by admin"
        : undefined
    } else if (overrideCents !== null) {
      payload.overrideTotalCents = overrideCents
    }

    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error?.[0]?.message || data.error || "Failed to create")
      setSubmitting(false)
      return
    }

    toast.success(
      paymentAction === "send_request"
        ? "Booking created — payment request sent"
        : "Booking created"
    )
    setOpen(false)
    reset()
    setSubmitting(false)
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger>
          <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold">
            <Plus className="h-4 w-4 mr-1" />
            New Session
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-bg-secondary border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide">
            New Session for User
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Customer */}
          <div className="space-y-2">
            <Label>Customer</Label>
            <button
              type="button"
              onClick={() => setCustomerListOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-bg-elevated border border-border rounded-md px-3 py-2 text-sm hover:border-brand-orange/50"
            >
              <span
                className={cn(
                  selectedCustomer ? "text-text-primary" : "text-text-muted"
                )}
              >
                {selectedCustomer
                  ? `${selectedCustomer.first_name} ${selectedCustomer.last_name} — ${selectedCustomer.email}`
                  : "Select a customer..."}
              </span>
              <ChevronDown className="h-4 w-4 text-text-muted" />
            </button>
            {customerListOpen && (
              <div className="border border-border rounded-md bg-bg-elevated overflow-hidden">
                <Command>
                  <CommandInput
                    placeholder="Search by name or email..."
                    value={customerSearch}
                    onValueChange={setCustomerSearch}
                  />
                  <CommandList className="max-h-60">
                    <CommandEmpty>No customers found.</CommandEmpty>
                    {filteredCustomers.slice(0, 30).map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.first_name} ${c.last_name} ${c.email}`}
                        onSelect={() => {
                          setCustomerId(c.id)
                          setCustomerListOpen(false)
                          setCustomerSearch("")
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {c.first_name} {c.last_name}
                          </span>
                          <span className="text-xs text-text-muted">
                            {c.email}
                            {c.role !== "customer" && ` · ${c.role}`}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </div>
            )}
          </div>

          {/* Quick Comp Session toggle */}
          <div className="flex items-center justify-between bg-bg-elevated rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Quick comp session</p>
              <p className="text-xs text-text-muted">
                Skip rate / payment — books a free session for the customer.
              </p>
            </div>
            <Switch checked={compMode} onCheckedChange={setCompMode} />
          </div>

          {/* Rate */}
          {!compMode && (
            <div className="space-y-2">
              <Label>Rate</Label>
              <Select value={rateId} onValueChange={(v) => v && setRateId(v)}>
                <SelectTrigger className="bg-bg-elevated border-border">
                  <SelectValue placeholder="Select a rate..." />
                </SelectTrigger>
                <SelectContent>
                  {rates.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — {formatCents(r.price_cents)}/{r.per_unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date + slots */}
          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div>
              <Label className="block mb-2">Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  setSelectedDate(d || undefined)
                  setSelectedSlots([])
                }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-lg border border-border bg-bg-elevated"
              />
            </div>
            <div>
              <Label className="block mb-2">Time</Label>
              {!selectedDate && (
                <p className="text-text-muted text-xs py-4">
                  Pick a date to see slots
                </p>
              )}
              {selectedDate && loadingAvailability && (
                <p className="text-text-muted text-xs py-4">Loading…</p>
              )}
              {selectedDate && !loadingAvailability && (
                <TimeSlotGrid
                  slots={daySlots}
                  selectedSlots={selectedSlots}
                  onSlotsChanged={setSelectedSlots}
                  maxSlots={(selectedRate?.max_hours || 10) * 2}
                  minSlots={1}
                />
              )}
            </div>
          </div>

          {/* Participants */}
          {selectedRate && selectedRate.max_people > 1 && (
            <div className="space-y-2">
              <Label>Participants</Label>
              <Input
                type="number"
                min={selectedRate.min_people}
                max={selectedRate.max_people}
                value={participantCount}
                onChange={(e) =>
                  setParticipantCount(parseInt(e.target.value) || 1)
                }
                className="bg-bg-elevated border-border w-32"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>
              Notes <span className="text-text-muted">(optional)</span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visible to the customer"
              className="bg-bg-elevated border-border"
              rows={2}
            />
          </div>

          {/* Fee summary + override */}
          {compMode ? (
            <div className="bg-bg-elevated rounded-lg border border-border p-4 flex items-center justify-between text-sm">
              <span className="text-text-secondary">Final total</span>
              <span className="font-display font-bold text-brand-orange">
                FREE
              </span>
            </div>
          ) : (
            <div className="bg-bg-elevated rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Calculated total</span>
                <span className="font-display font-bold">
                  {formatCents(calculatedCents)}
                </span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Override fee{" "}
                  <span className="text-text-muted">
                    (leave blank to use calculated)
                  </span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={overrideFee}
                  onChange={(e) => setOverrideFee(e.target.value)}
                  className="bg-bg-secondary border-border"
                />
              </div>
              <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                <span className="text-text-secondary">Final total</span>
                <span className="font-display font-bold text-brand-orange">
                  {formatCents(finalCents)}
                </span>
              </div>
            </div>
          )}

          {/* Payment action */}
          {!compMode && (
          <>
          <div className="space-y-2">
            <Label>Payment</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "mark_paid", label: "Mark Paid" },
                  { value: "comp", label: "Comp (Free)" },
                  { value: "send_request", label: "Send Request" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentAction(opt.value)}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium border transition-colors",
                    paymentAction === opt.value
                      ? "bg-brand-orange text-white border-brand-orange"
                      : "bg-bg-elevated border-border text-text-secondary hover:border-brand-orange/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              {paymentAction === "mark_paid" &&
                "Booking is confirmed. A payment record is created so reports balance."}
              {paymentAction === "comp" &&
                "Booking is confirmed at no cost. Override above to record a partial credit."}
              {paymentAction === "send_request" &&
                "Booking is held as pending payment. Customer pays via their portal."}
            </p>
          </div>

          {paymentAction === "mark_paid" && (
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
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
          )}
          </>
          )}

          {/* Notify */}
          <div className="flex items-center justify-between bg-bg-elevated rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Notify customer</p>
              <p className="text-xs text-text-muted">
                {paymentAction === "send_request"
                  ? "Sends a pay-now email and SMS"
                  : "Sends a confirmation email and SMS"}
              </p>
            </div>
            <Switch checked={notify} onCheckedChange={setNotify} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

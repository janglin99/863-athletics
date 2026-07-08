"use client"

import { useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command"
import { formatDateTime } from "@/lib/utils/format"
import { formatEastern } from "@/lib/utils/timezone"
import { toast } from "sonner"
import { Plus, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Profile, Booking } from "@/types"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

type PeriodType = "session" | "day" | "week" | "month" | "custom"

interface Props {
  fixedCustomerId?: string
  trigger?: ReactNode
  onGenerated: () => void
}

export function GenerateInvoiceDialog({
  fixedCustomerId,
  trigger,
  onGenerated,
}: Props) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Customer picker (only used when fixedCustomerId is not provided)
  const [customers, setCustomers] = useState<Profile[]>([])
  const [pickedCustomerId, setPickedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerListOpen, setCustomerListOpen] = useState(false)

  const activeCustomerId = fixedCustomerId || pickedCustomerId
  const selectedCustomer = customers.find((c) => c.id === pickedCustomerId)

  const [customerBookings, setCustomerBookings] = useState<Booking[]>([])

  // "Today" as the facility (Eastern) sees it, not the admin's own browser
  // timezone or UTC — otherwise these defaults can silently point at the
  // wrong day/month depending on where staff happen to be.
  const todayEastern = formatEastern(new Date(), "yyyy-MM-dd")
  const [periodType, setPeriodType] = useState<PeriodType>("month")
  const [month, setMonth] = useState(Number(formatEastern(new Date(), "M")))
  const [year, setYear] = useState(Number(formatEastern(new Date(), "yyyy")))
  const [date, setDate] = useState(todayEastern)
  const [customStart, setCustomStart] = useState(todayEastern)
  const [customEnd, setCustomEnd] = useState(todayEastern)
  const [bookingId, setBookingId] = useState("")
  const [publishImmediately, setPublishImmediately] = useState(false)

  useEffect(() => {
    if (!open || fixedCustomerId) return
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, role")
        .order("first_name", { ascending: true })
        .limit(500)
      setCustomers((data as Profile[]) || [])
    }
    load()
  }, [open, fixedCustomerId])

  useEffect(() => {
    if (!activeCustomerId) {
      setCustomerBookings([])
      return
    }
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("bookings")
        .select("*, rate:rates(name), slots:booking_slots(*)")
        .eq("customer_id", activeCustomerId)
        .order("created_at", { ascending: false })
        .limit(20)
      setCustomerBookings((data as Booking[]) || [])
    }
    load()
  }, [activeCustomerId])

  const resetForm = () => {
    const resetToday = formatEastern(new Date(), "yyyy-MM-dd")
    setPickedCustomerId("")
    setCustomerSearch("")
    setCustomerBookings([])
    setPeriodType("month")
    setMonth(Number(formatEastern(new Date(), "M")))
    setYear(Number(formatEastern(new Date(), "yyyy")))
    setDate(resetToday)
    setCustomStart(resetToday)
    setCustomEnd(resetToday)
    setBookingId("")
    setPublishImmediately(false)
  }

  const handleGenerate = async () => {
    if (!activeCustomerId) {
      toast.error("Select a customer")
      return
    }
    if (periodType === "session" && !bookingId) {
      toast.error("Select a session")
      return
    }
    if (periodType === "custom" && new Date(customStart) > new Date(customEnd)) {
      toast.error("Start date must be on or before end date")
      return
    }
    setGenerating(true)
    const body: Record<string, unknown> = {
      customerId: activeCustomerId,
      periodType,
      publish: publishImmediately,
    }
    if (periodType === "month") {
      // Plain "YYYY-MM-DD" — the server anchors this to the facility's
      // timezone, so this must not go through a local Date object first
      // (that would tie the result to the admin's browser timezone).
      body.referenceDate = `${year}-${String(month).padStart(2, "0")}-01`
    } else if (periodType === "day" || periodType === "week") {
      body.referenceDate = date
    } else if (periodType === "custom") {
      body.startDate = customStart
      body.endDate = customEnd
    } else {
      body.bookingId = bookingId
    }

    const res = await fetch("/api/customer-invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      toast.success("Invoice generated")
      setOpen(false)
      resetForm()
      onGenerated()
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to generate invoice")
    }
    setGenerating(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger>
        {trigger ?? (
          <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold">
            <Plus className="h-4 w-4 mr-1" />
            Generate Invoice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-bg-secondary border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide">
            Generate Invoice
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {!fixedCustomerId && (
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
                      {customers
                        .filter((c) => {
                          if (!customerSearch) return true
                          const q = customerSearch.toLowerCase()
                          return (
                            c.first_name.toLowerCase().includes(q) ||
                            c.last_name.toLowerCase().includes(q) ||
                            c.email.toLowerCase().includes(q)
                          )
                        })
                        .slice(0, 30)
                        .map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.first_name} ${c.last_name} ${c.email}`}
                            onSelect={() => {
                              setPickedCustomerId(c.id)
                              setBookingId("")
                              setCustomerListOpen(false)
                              setCustomerSearch("")
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {c.first_name} {c.last_name}
                                {c.role !== "customer" && (
                                  <span className="text-text-muted"> · {c.role}</span>
                                )}
                              </span>
                              <span className="text-xs text-text-muted">
                                {c.email}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Bill By</Label>
            <Select
              value={periodType}
              onValueChange={(v) => v && setPeriodType(v as PeriodType)}
            >
              <SelectTrigger className="bg-bg-elevated border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
                <SelectItem value="session">Single Session</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodType === "month" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => v && setMonth(Number(v))}
                >
                  <SelectTrigger className="bg-bg-elevated border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="bg-bg-elevated border-border"
                />
              </div>
            </div>
          )}

          {(periodType === "day" || periodType === "week") && (
            <div className="space-y-2">
              <Label>
                {periodType === "day" ? "Date" : "Any date in the week"}
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-bg-elevated border-border"
              />
            </div>
          )}

          {periodType === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-bg-elevated border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-bg-elevated border-border"
                />
              </div>
            </div>
          )}

          {periodType === "session" && (
            <div className="space-y-2">
              <Label>Session</Label>
              <Select
                value={bookingId}
                onValueChange={(v) => v && setBookingId(v)}
                disabled={!activeCustomerId}
              >
                <SelectTrigger className="bg-bg-elevated border-border">
                  <SelectValue
                    placeholder={
                      activeCustomerId
                        ? "Select a booking"
                        : "Select a customer first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {customerBookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.booking_number} · {b.rate?.name}
                      {b.slots?.[0] && ` · ${formatDateTime(b.slots[0].start_time)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-start gap-3 bg-bg-elevated rounded-md border border-border px-3 py-2.5">
            <Checkbox
              id="publish-immediately"
              checked={publishImmediately}
              onCheckedChange={(c) => setPublishImmediately(c === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="publish-immediately"
              className="text-sm font-normal cursor-pointer"
            >
              Publish to customer portal immediately
              <span className="block text-xs text-text-muted mt-0.5">
                Otherwise this invoice is saved as a draft — only visible to
                staff until you publish it.
              </span>
            </Label>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
          >
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { CustomerInvoiceList } from "@/components/admin/CustomerInvoiceList"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import { toast } from "sonner"
import { Plus, Loader2, Search, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Profile, Booking, CustomerInvoice } from "@/types"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function AdminCustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Generate dialog state
  const [generateOpen, setGenerateOpen] = useState(false)
  const [customers, setCustomers] = useState<Profile[]>([])
  const [customerId, setCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerListOpen, setCustomerListOpen] = useState(false)
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([])

  const now = new Date()
  const [periodType, setPeriodType] = useState<
    "session" | "day" | "week" | "month"
  >("month")
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [date, setDate] = useState(now.toISOString().slice(0, 10))
  const [bookingId, setBookingId] = useState("")
  const [generating, setGenerating] = useState(false)

  const selectedCustomer = customers.find((c) => c.id === customerId)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/customer-invoices")
    if (res.ok) {
      setInvoices(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  // Load customers when the generate dialog opens
  useEffect(() => {
    if (!generateOpen) return
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, role")
        .eq("role", "customer")
        .order("first_name", { ascending: true })
        .limit(500)
      setCustomers((data as Profile[]) || [])
    }
    load()
  }, [generateOpen])

  // Load the selected customer's recent bookings (needed for "Single Session")
  useEffect(() => {
    if (!customerId) {
      setCustomerBookings([])
      return
    }
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("bookings")
        .select("*, rate:rates(name), slots:booking_slots(*)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20)
      setCustomerBookings((data as Booking[]) || [])
    }
    load()
  }, [customerId])

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch) return true
    const q = customerSearch.toLowerCase()
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  })

  const resetGenerateForm = () => {
    setCustomerId("")
    setCustomerSearch("")
    setCustomerBookings([])
    setPeriodType("month")
    setMonth(now.getMonth() + 1)
    setYear(now.getFullYear())
    setDate(now.toISOString().slice(0, 10))
    setBookingId("")
  }

  const handleGenerate = async () => {
    if (!customerId) {
      toast.error("Select a customer")
      return
    }
    if (periodType === "session" && !bookingId) {
      toast.error("Select a session")
      return
    }
    setGenerating(true)
    const body: Record<string, unknown> = { customerId, periodType }
    if (periodType === "month") {
      body.referenceDate = new Date(year, month - 1, 1).toISOString()
    } else if (periodType === "day" || periodType === "week") {
      body.referenceDate = new Date(date).toISOString()
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
      setGenerateOpen(false)
      resetGenerateForm()
      await loadInvoices()
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to generate invoice")
    }
    setGenerating(false)
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = inv.customer
      ? `${inv.customer.first_name} ${inv.customer.last_name}`.toLowerCase()
      : ""
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      name.includes(q) ||
      inv.customer?.email?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <PageHeader
        title="Customer Invoices"
        description="Generate and manage invoices saved to customer profiles"
        action={
          <Dialog
            open={generateOpen}
            onOpenChange={(open) => {
              setGenerateOpen(open)
              if (!open) resetGenerateForm()
            }}
          >
            <DialogTrigger>
              <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold">
                <Plus className="h-4 w-4 mr-1" />
                Generate Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-bg-secondary border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display uppercase tracking-wide">
                  Generate Invoice
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
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
                                setBookingId("")
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
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Bill By</Label>
                  <Select
                    value={periodType}
                    onValueChange={(v) =>
                      v && setPeriodType(v as "session" | "day" | "week" | "month")
                    }
                  >
                    <SelectTrigger className="bg-bg-elevated border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
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

                {periodType === "session" && (
                  <div className="space-y-2">
                    <Label>Session</Label>
                    <Select
                      value={bookingId}
                      onValueChange={(v) => v && setBookingId(v)}
                      disabled={!customerId}
                    >
                      <SelectTrigger className="bg-bg-elevated border-border">
                        <SelectValue
                          placeholder={
                            customerId
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
        }
      />

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search by customer or invoice number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-bg-elevated border-border max-w-md"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <CustomerInvoiceList
          invoices={filteredInvoices}
          onChanged={loadInvoices}
          showCustomer
          emptyMessage={
            invoices.length === 0
              ? 'No invoices yet. Click "Generate Invoice" to create one.'
              : "No invoices match your search."
          }
        />
      )}
    </div>
  )
}

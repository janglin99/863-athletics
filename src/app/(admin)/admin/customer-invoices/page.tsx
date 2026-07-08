"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { CustomerInvoiceList } from "@/components/admin/CustomerInvoiceList"
import { GenerateInvoiceDialog } from "@/components/admin/GenerateInvoiceDialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import type { CustomerInvoice } from "@/types"

export default function AdminCustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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
        action={<GenerateInvoiceDialog onGenerated={loadInvoices} />}
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

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils/format"
import { Search, Users } from "lucide-react"
import type { Profile } from "@/types"

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Profile[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200)

      setCustomers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = customers.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${customers.length} registered users`}
      />

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-bg-elevated border-border max-w-md"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => (
            <Link
              key={customer.id}
              href={`/admin/customers/${customer.id}`}
            >
              <Card className="bg-bg-secondary border-border hover:border-brand-orange/50 transition-colors cursor-pointer">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-bg-elevated flex items-center justify-center text-sm font-bold text-text-secondary">
                        {customer.first_name[0]}
                        {customer.last_name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {customer.first_name} {customer.last_name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {customer.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="capitalize text-xs border-border"
                      >
                        {customer.role}
                      </Badge>
                      <span className="text-xs text-text-muted">
                        {formatDateTime(customer.created_at)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

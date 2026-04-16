"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils/format"
import { KeyRound } from "lucide-react"
import type { AccessCode } from "@/types"

type AccessCodeWithBooking = AccessCode & {
  booking?: { booking_number: string }
}

const STATUS_COLORS: Record<string, string> = {
  active: "border-green-500/50 text-green-400",
  pending: "border-yellow-500/50 text-yellow-400",
  expired: "border-text-muted text-text-muted",
  revoked: "border-red-500/50 text-red-400",
  failed: "border-red-500/50 text-red-400",
}

export default function AdminAccessCodesPage() {
  const [codes, setCodes] = useState<AccessCodeWithBooking[]>([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("access_codes")
        .select("*, booking:bookings!booking_id(booking_number)")
        .order("created_at", { ascending: false })
        .limit(100)

      setCodes(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = codes.filter((c) => {
    if (filter === "all") return true
    return c.status === filter
  })

  return (
    <div>
      <PageHeader
        title="Access Codes"
        description={`${codes.length} access codes`}
      />

      <div className="mb-6">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-bg-secondary">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
            <TabsTrigger value="revoked">Revoked</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((code) => (
            <Card
              key={code.id}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-bg-elevated flex items-center justify-center">
                      <KeyRound className="h-4 w-4 text-brand-orange" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm tracking-widest">
                        {code.pin_code}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Booking: {code.booking?.booking_number || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-text-secondary">
                        {formatDateTime(code.valid_from)}
                      </p>
                      <p className="text-xs text-text-muted">
                        to {formatDateTime(code.valid_until)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`capitalize text-xs ${
                        STATUS_COLORS[code.status] || "border-border"
                      }`}
                    >
                      {code.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <p className="text-text-secondary text-center py-8">
              No access codes found
            </p>
          )}
        </div>
      )}
    </div>
  )
}

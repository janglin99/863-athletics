"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils/format"
import { Clock, CalendarOff } from "lucide-react"
import type { FacilityHours, AvailabilityBlock } from "@/types"

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export default function AdminAvailabilityPage() {
  const [hours, setHours] = useState<FacilityHours[]>([])
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [hoursRes, blocksRes] = await Promise.all([
        supabase
          .from("facility_hours")
          .select("*")
          .order("day_of_week", { ascending: true }),
        supabase
          .from("availability_blocks")
          .select("*")
          .order("start_time", { ascending: false })
          .limit(50),
      ])

      setHours(hoursRes.data || [])
      setBlocks(blocksRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function toggleDay(row: FacilityHours) {
    setSaving(row.id)
    const supabase = createClient()
    const { data } = await supabase
      .from("facility_hours")
      .update({ is_open: !row.is_open })
      .eq("id", row.id)
      .select()
      .single()

    if (data) {
      setHours((prev) => prev.map((h) => (h.id === data.id ? data : h)))
    }
    setSaving(null)
  }

  async function updateTime(
    row: FacilityHours,
    field: "open_time" | "close_time",
    value: string
  ) {
    setSaving(row.id)
    const supabase = createClient()
    const { data } = await supabase
      .from("facility_hours")
      .update({ [field]: value })
      .eq("id", row.id)
      .select()
      .single()

    if (data) {
      setHours((prev) => prev.map((h) => (h.id === data.id ? data : h)))
    }
    setSaving(null)
  }

  return (
    <div>
      <PageHeader
        title="Availability"
        description="Manage facility hours and availability blocks"
      />

      {/* Facility Hours */}
      <h2 className="text-lg font-display font-bold uppercase tracking-wide text-text-primary mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-brand-orange" />
        Facility Hours
      </h2>

      {loading ? (
        <div className="space-y-3 mb-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {hours.map((row) => (
            <Card
              key={row.id}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-32">
                    <Switch
                      checked={row.is_open}
                      onCheckedChange={() => toggleDay(row)}
                      disabled={saving === row.id}
                    />
                    <span className="font-semibold text-sm">
                      {DAY_NAMES[row.day_of_week]}
                    </span>
                  </div>
                  {row.is_open ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={row.open_time}
                        onChange={(e) =>
                          updateTime(row, "open_time", e.target.value)
                        }
                        className="w-32 bg-bg-elevated border-border text-sm"
                        disabled={saving === row.id}
                      />
                      <span className="text-text-muted text-sm">to</span>
                      <Input
                        type="time"
                        value={row.close_time}
                        onChange={(e) =>
                          updateTime(row, "close_time", e.target.value)
                        }
                        className="w-32 bg-bg-elevated border-border text-sm"
                        disabled={saving === row.id}
                      />
                    </div>
                  ) : (
                    <span className="text-text-muted text-sm">Closed</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Availability Blocks */}
      <h2 className="text-lg font-display font-bold uppercase tracking-wide text-text-primary mb-4 flex items-center gap-2">
        <CalendarOff className="h-5 w-5 text-brand-orange" />
        Availability Blocks
      </h2>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <p className="text-text-secondary text-center py-8">
          No availability blocks
        </p>
      ) : (
        <div className="space-y-2">
          {blocks.map((block) => (
            <Card
              key={block.id}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{block.title}</p>
                    <p className="text-xs text-text-secondary">
                      {formatDateTime(block.start_time)} &mdash;{" "}
                      {formatDateTime(block.end_time)}
                    </p>
                    {block.reason && (
                      <p className="text-xs text-text-muted mt-1">
                        {block.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.is_recurring && (
                      <Badge
                        variant="outline"
                        className="text-xs border-brand-orange/50 text-brand-orange"
                      >
                        Recurring
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

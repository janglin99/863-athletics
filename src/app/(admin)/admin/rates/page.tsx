"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatCents } from "@/lib/utils/format"
import { DollarSign } from "lucide-react"
import type { Rate } from "@/types"

export default function AdminRatesPage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("rates")
        .select("*")
        .order("sort_order", { ascending: true })

      setRates(data || [])
      setLoading(false)
    }
    load()
  }, [])

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

  return (
    <div>
      <PageHeader
        title="Rates"
        description={`${rates.length} rate${rates.length !== 1 ? "s" : ""} configured`}
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
                  <Switch
                    checked={rate.is_active}
                    onCheckedChange={() => toggleActive(rate)}
                    disabled={toggling === rate.id}
                  />
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
    </div>
  )
}

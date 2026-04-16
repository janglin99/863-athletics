"use client"

import { cn } from "@/lib/utils"
import { formatCents } from "@/lib/utils/format"
import type { Rate } from "@/types"
import {
  Clock,
  Users,
  Dumbbell,
  Calendar,
  Zap,
  Crown,
} from "lucide-react"

const iconMap: Record<string, React.ElementType> = {
  drop_in_1hr: Clock,
  drop_in_multi: Clock,
  day_pass: Calendar,
  trainer_private: Crown,
  trainer_group_small: Users,
  trainer_group_large: Users,
  membership_monthly: Zap,
  pack_5: Dumbbell,
  pack_10: Dumbbell,
  staff_access: Dumbbell,
  event: Calendar,
}

interface RateSelectorProps {
  rates: Rate[]
  selectedRate: Rate | null
  onSelect: (rate: Rate) => void
  filter?: string
}

export function RateSelector({
  rates,
  selectedRate,
  onSelect,
  filter,
}: RateSelectorProps) {
  const filteredRates = filter
    ? rates.filter((r) => {
        if (filter === "open_gym")
          return ["drop_in_1hr", "drop_in_multi", "day_pass"].includes(r.type)
        if (filter === "training")
          return [
            "trainer_private",
            "trainer_group_small",
            "trainer_group_large",
          ].includes(r.type)
        if (filter === "packages")
          return ["pack_5", "pack_10", "membership_monthly"].includes(r.type)
        return true
      })
    : rates

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {filteredRates.map((rate) => {
        const Icon = iconMap[rate.type] || Dumbbell
        const isSelected = selectedRate?.id === rate.id

        return (
          <button
            key={rate.id}
            onClick={() => onSelect(rate)}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border text-left transition-all",
              isSelected
                ? "border-brand-orange bg-brand-orange/5 shadow-lg shadow-brand-orange-glow"
                : "border-border bg-bg-secondary hover:border-brand-orange/50 hover:bg-bg-hover"
            )}
          >
            <div
              className="rounded-md p-2.5 shrink-0"
              style={{ backgroundColor: `${rate.color_hex}15` }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: rate.color_hex }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-text-primary truncate">
                  {rate.name}
                </h3>
                <span
                  className="text-lg font-display font-bold shrink-0"
                  style={{ color: rate.color_hex }}
                >
                  {formatCents(rate.price_cents)}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1">
                {rate.description}
              </p>
              <p className="text-xs text-text-muted mt-1">
                per {rate.per_unit}
                {rate.max_people > 1 &&
                  ` · ${rate.min_people}-${rate.max_people} people`}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

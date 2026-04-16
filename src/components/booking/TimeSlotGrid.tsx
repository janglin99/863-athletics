"use client"

import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/utils/format"
import type { TimeSlot } from "@/types"

interface TimeSlotGridProps {
  slots: TimeSlot[]
  selectedSlots: { start: string; end: string }[]
  onToggleSlot: (slot: { start: string; end: string }) => void
  maxSlots?: number
}

export function TimeSlotGrid({
  slots,
  selectedSlots,
  onToggleSlot,
  maxSlots = 10,
}: TimeSlotGridProps) {
  const availableSlots = slots.filter((s) => s.available)

  if (slots.length === 0) {
    return (
      <p className="text-text-secondary text-sm py-4">
        No slots available for this day.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {availableSlots.length} slots available
          {selectedSlots.length > 0 && (
            <span className="text-brand-orange ml-2">
              ({selectedSlots.length} selected)
            </span>
          )}
        </p>
        {selectedSlots.length > 0 && (
          <p className="text-sm font-mono text-brand-orange">
            {selectedSlots.length}h selected
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedSlots.some((s) => s.start === slot.start)
          const isDisabled =
            !slot.available ||
            (!isSelected && selectedSlots.length >= maxSlots)

          return (
            <button
              key={slot.start}
              onClick={() =>
                !isDisabled && onToggleSlot({ start: slot.start, end: slot.end })
              }
              disabled={isDisabled && !isSelected}
              className={cn(
                "px-3 py-2.5 rounded-md text-sm font-medium transition-all",
                isSelected
                  ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
                  : slot.available
                    ? "bg-bg-elevated text-text-primary hover:bg-bg-hover hover:border-brand-orange border border-border"
                    : "bg-bg-primary text-text-muted border border-border/50 cursor-not-allowed opacity-50"
              )}
            >
              {formatTime(slot.start)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

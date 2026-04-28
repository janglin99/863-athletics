"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/utils/format"
import type { TimeSlot } from "@/types"

interface TimeSlotGridProps {
  slots: TimeSlot[]
  selectedSlots: { start: string; end: string }[]
  onSlotsChanged: (slots: { start: string; end: string }[]) => void
  maxSlots?: number
  minSlots?: number
}

export function TimeSlotGrid({
  slots,
  selectedSlots,
  onSlotsChanged,
  maxSlots = 20,
  minSlots = 2,
}: TimeSlotGridProps) {
  const [mode, setMode] = useState<"idle" | "extending">("idle")
  const availableSlots = slots.filter((s) => s.available)

  if (slots.length === 0) {
    return (
      <p className="text-text-secondary text-sm py-4">
        No slots available for this day.
      </p>
    )
  }

  const totalHours =
    selectedSlots.reduce((ms, slot) => {
      return (
        ms + (new Date(slot.end).getTime() - new Date(slot.start).getTime())
      )
    }, 0) /
    (1000 * 60 * 60)
  const displayStart =
    selectedSlots.length > 0 ? selectedSlots[0].start : null
  const displayEnd =
    selectedSlots.length > 0
      ? selectedSlots[selectedSlots.length - 1].end
      : null

  const handleSlotClick = (index: number) => {
    const slot = slots[index]
    if (!slot.available) return

    if (mode === "idle" || selectedSlots.length === 0) {
      // First click: auto-select 1 hour (this slot + next slot)
      const endIdx = index + 1
      if (endIdx < slots.length && slots[endIdx].available) {
        // Select 2 slots (1 hour)
        const selected = slots.slice(index, endIdx + 1).map((s) => ({
          start: s.start,
          end: s.end,
        }))
        onSlotsChanged(selected)
      } else {
        // Only one slot available, select just this one
        onSlotsChanged([{ start: slot.start, end: slot.end }])
      }
      setMode("extending")
    } else if (mode === "extending") {
      // Already have a selection — user is adjusting the end time
      const currentStartIdx = slots.findIndex(
        (s) => s.start === selectedSlots[0].start
      )

      if (index === currentStartIdx) {
        // Clicked the current START — clear so user can pick a new time
        setMode("idle")
        onSlotsChanged([])
        return
      }

      if (index < currentStartIdx) {
        // Clicked before start — new start with auto 1-hour selection
        const endIdx = index + 1
        if (endIdx < slots.length && slots[endIdx].available) {
          const selected = slots.slice(index, endIdx + 1).map((s) => ({
            start: s.start,
            end: s.end,
          }))
          onSlotsChanged(selected)
        } else {
          onSlotsChanged([{ start: slot.start, end: slot.end }])
        }
        return
      }

      // Extend/shrink to this slot as the END time
      // The clicked button represents the end time, so we select slots from start through this index
      const rangeSlots = slots.slice(currentStartIdx, index + 1)
      const allAvailable = rangeSlots.every((s) => s.available)

      if (!allAvailable) {
        // Can't span across unavailable slots
        return
      }

      if (rangeSlots.length > maxSlots) {
        return
      }

      const selected = rangeSlots.map((s) => ({
        start: s.start,
        end: s.end,
      }))
      onSlotsChanged(selected)
    }
  }

  const handleClear = () => {
    setMode("idle")
    onSlotsChanged([])
  }

  const isSlotSelected = (index: number) =>
    selectedSlots.some((s) => s.start === slots[index].start)

  // Find the end time button index (the slot AFTER the last selected slot)
  const lastSelectedIdx =
    selectedSlots.length > 0
      ? slots.findIndex(
          (s) => s.start === selectedSlots[selectedSlots.length - 1].start
        )
      : -1
  const endButtonIdx = lastSelectedIdx + 1

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {mode === "idle"
            ? "Select your start time"
            : "Click later for end · click START to reset"}
          <span className="text-text-muted ml-2">
            ({availableSlots.length} slots available)
          </span>
        </p>
        {selectedSlots.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {slots.map((slot, index) => {
          const selected = isSlotSelected(index)
          const isDisabled = !slot.available
          const isEndButton = index === endButtonIdx && selectedSlots.length > 0

          // Labels
          const isFirstSelected =
            selected &&
            selectedSlots.length > 0 &&
            slot.start === selectedSlots[0].start

          return (
            <button
              key={slot.start}
              onClick={() => handleSlotClick(index)}
              disabled={isDisabled}
              className={cn(
                "px-3 py-2.5 rounded-md text-sm font-medium transition-all relative",
                selected
                  ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
                  : isEndButton
                    ? "bg-brand-orange/20 text-brand-orange border border-brand-orange/50"
                    : slot.available
                      ? "bg-bg-elevated text-text-primary hover:bg-bg-hover hover:border-brand-orange border border-border"
                      : "bg-bg-primary text-text-muted border border-border/50 cursor-not-allowed opacity-50"
              )}
            >
              {formatTime(slot.start)}
              {isFirstSelected && (
                <span className="absolute -top-1.5 -left-1 text-[10px] bg-brand-orange-dark text-white px-1 rounded">
                  START
                </span>
              )}
              {isEndButton && !isDisabled && (
                <span className="absolute -top-1.5 -right-1 text-[10px] bg-brand-orange-dark text-white px-1 rounded">
                  END
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selection summary */}
      {selectedSlots.length >= minSlots && displayStart && displayEnd && (
        <div className="bg-bg-elevated rounded-lg border border-brand-orange/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-text-secondary">Session: </span>
              <span className="font-mono font-semibold text-text-primary">
                {formatTime(displayStart)} — {formatTime(displayEnd)}
              </span>
            </div>
          </div>
          <span className="text-sm font-display font-bold text-brand-orange">
            {totalHours}h
          </span>
        </div>
      )}
    </div>
  )
}

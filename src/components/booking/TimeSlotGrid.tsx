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
  maxSlots = 10,
  minSlots = 2,
}: TimeSlotGridProps) {
  const [startIndex, setStartIndex] = useState<number | null>(null)
  const availableSlots = slots.filter((s) => s.available)

  if (slots.length === 0) {
    return (
      <p className="text-text-secondary text-sm py-4">
        No slots available for this day.
      </p>
    )
  }

  // Find the end time display for the last slot
  const totalHours = selectedSlots.reduce((ms, slot) => {
    return ms + (new Date(slot.end).getTime() - new Date(slot.start).getTime())
  }, 0) / (1000 * 60 * 60)
  const startTime = selectedSlots.length > 0 ? selectedSlots[0].start : null
  const endTime =
    selectedSlots.length > 0
      ? selectedSlots[selectedSlots.length - 1].end
      : null

  const handleSlotClick = (index: number) => {
    const slot = slots[index]
    if (!slot.available) return

    if (startIndex === null) {
      // First click: set start time
      setStartIndex(index)
      onSlotsChanged([{ start: slot.start, end: slot.end }])
    } else if (index === startIndex) {
      // Clicking same slot: deselect
      setStartIndex(null)
      onSlotsChanged([])
    } else {
      // Second click: set end time and select range
      const fromIdx = Math.min(startIndex, index)
      const toIdx = Math.max(startIndex, index)

      // Check all slots in range are available and within max
      const rangeSlots = slots.slice(fromIdx, toIdx + 1)
      const allAvailable = rangeSlots.every((s) => s.available)
      const rangeCount = rangeSlots.length

      if (!allAvailable) {
        // Can't span across unavailable slots — reset and pick this as new start
        setStartIndex(index)
        onSlotsChanged([{ start: slot.start, end: slot.end }])
        return
      }

      if (rangeCount > maxSlots) {
        return // Too many hours
      }

      // Select the full range
      const selected = rangeSlots.map((s) => ({
        start: s.start,
        end: s.end,
      }))
      onSlotsChanged(selected)
      setStartIndex(null) // Reset for next selection
    }
  }

  const handleClear = () => {
    setStartIndex(null)
    onSlotsChanged([])
  }

  // Determine which slots are in the selected range
  const isSlotSelected = (index: number) =>
    selectedSlots.some((s) => s.start === slots[index].start)

  // When only start is picked, show it as "selecting"
  const isStartSlot = (index: number) =>
    startIndex !== null && index === startIndex && selectedSlots.length <= 1

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {startIndex !== null && selectedSlots.length <= 1
            ? "Now select your end time"
            : "Select your start time"}
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
          const isStart = isStartSlot(index)
          const isDisabled = !slot.available

          // Determine if this is first, last, or middle of selection
          const isFirstSelected =
            selected &&
            selectedSlots.length > 0 &&
            slot.start === selectedSlots[0].start
          const isLastSelected =
            selected &&
            selectedSlots.length > 1 &&
            slot.start === selectedSlots[selectedSlots.length - 1].start

          return (
            <button
              key={slot.start}
              onClick={() => handleSlotClick(index)}
              disabled={isDisabled}
              className={cn(
                "px-3 py-2.5 rounded-md text-sm font-medium transition-all relative",
                selected || isStart
                  ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
                  : slot.available
                    ? "bg-bg-elevated text-text-primary hover:bg-bg-hover hover:border-brand-orange border border-border"
                    : "bg-bg-primary text-text-muted border border-border/50 cursor-not-allowed opacity-50"
              )}
            >
              {formatTime(slot.start)}
              {isFirstSelected && selectedSlots.length > 1 && (
                <span className="absolute -top-1.5 -left-1 text-[10px] bg-brand-orange-dark text-white px-1 rounded">
                  START
                </span>
              )}
              {isLastSelected && (
                <span className="absolute -top-1.5 -right-1 text-[10px] bg-brand-orange-dark text-white px-1 rounded">
                  END
                </span>
              )}
              {isStart && selectedSlots.length <= 1 && (
                <span className="absolute -top-1.5 -left-1 text-[10px] bg-brand-orange-dark text-white px-1 rounded">
                  START
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selection summary */}
      {selectedSlots.length > 0 && startTime && endTime && (
        <div className={`bg-bg-elevated rounded-lg border p-3 flex items-center justify-between ${
          selectedSlots.length < minSlots ? "border-warning/30" : "border-brand-orange/20"
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-text-secondary">Session: </span>
              <span className="font-mono font-semibold text-text-primary">
                {formatTime(startTime)} — {formatTime(endTime)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-display font-bold text-brand-orange">
              {totalHours}h
            </span>
            {selectedSlots.length < minSlots && (
              <p className="text-xs text-warning">
                Min {minSlots * 0.5}h required
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

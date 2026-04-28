"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addWeeks, addDays, getDay, nextDay, eachWeekOfInterval, startOfDay } from "date-fns"
import { CalendarIcon, Repeat, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCents } from "@/lib/utils/format"
import type { AvailabilityMap } from "@/types"

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
]

export interface RecurringConfig {
  enabled: boolean
  frequency: "weekly" | "biweekly"
  daysOfWeek: number[]
  startDate: Date
  endDate: Date
  timeSlots: { hour: number; minute: number }[] // selected 30-min slots
}

interface RecurringOptionsProps {
  config: RecurringConfig
  onChange: (config: RecurringConfig) => void
  priceCentsPerHour: number
  availability: AvailabilityMap
  minDate?: Date
}

export function getRecurringDates(config: RecurringConfig): Date[] {
  if (!config.enabled || config.daysOfWeek.length === 0) return []

  const dates: Date[] = []
  const start = startOfDay(config.startDate)
  const end = startOfDay(config.endDate)

  let current = new Date(start)
  while (current <= end) {
    const dayOfWeek = getDay(current)
    if (config.daysOfWeek.includes(dayOfWeek)) {
      dates.push(new Date(current))
    }
    current = addDays(current, 1)
  }

  // For biweekly, take every other occurrence
  if (config.frequency === "biweekly") {
    const filtered: Date[] = []
    const dayGroups: Record<number, Date[]> = {}
    for (const d of dates) {
      const dow = getDay(d)
      if (!dayGroups[dow]) dayGroups[dow] = []
      dayGroups[dow].push(d)
    }
    for (const dow of Object.keys(dayGroups)) {
      dayGroups[Number(dow)].forEach((d, i) => {
        if (i % 2 === 0) filtered.push(d)
      })
    }
    return filtered.sort((a, b) => a.getTime() - b.getTime())
  }

  return dates
}

export function RecurringOptions({
  config,
  onChange,
  priceCentsPerHour,
  availability,
  minDate,
}: RecurringOptionsProps) {
  const update = (partial: Partial<RecurringConfig>) =>
    onChange({ ...config, ...partial })

  const earliest = minDate ?? startOfDay(new Date())

  const recurringDates = getRecurringDates(config)
  const totalHoursPerSession = (config.timeSlots.length * 0.5) || 0.5
  const totalSessions = recurringDates.length
  const totalCents = Math.round(priceCentsPerHour * totalHoursPerSession * totalSessions)

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between bg-bg-secondary rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <Repeat className="h-5 w-5 text-brand-orange" />
          <div>
            <p className="font-semibold text-sm">Recurring Booking</p>
            <p className="text-xs text-text-secondary">
              Book the same time every week
            </p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
        />
      </div>

      {config.enabled && (
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6 space-y-5">
            {/* Frequency */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={config.frequency}
                onValueChange={(v) =>
                  update({ frequency: v as "weekly" | "biweekly" })
                }
              >
                <SelectTrigger className="bg-bg-elevated border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="biweekly">Every other week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Days of week */}
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const selected = config.daysOfWeek.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      onClick={() => {
                        const days = selected
                          ? config.daysOfWeek.filter((d) => d !== day.value)
                          : [...config.daysOfWeek, day.value]
                        update({ daysOfWeek: days })
                      }}
                      className={cn(
                        "h-10 w-10 rounded-md text-xs font-bold transition-all",
                        selected
                          ? "bg-brand-orange text-white"
                          : "bg-bg-elevated text-text-secondary border border-border hover:border-brand-orange/50"
                      )}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots — start/end selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {config.timeSlots.length === 0
                    ? "Select start time"
                    : "Click later for end · click START to reset"}
                </Label>
                {config.timeSlots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => update({ timeSlots: [] })}
                    className="text-xs text-text-secondary hover:text-brand-orange underline underline-offset-2"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {Array.from({ length: 32 }, (_, i) => ({
                  hour: Math.floor(i / 2) + 6,
                  minute: (i % 2) * 30,
                  index: i,
                })).map((slot) => {
                  const slotMin = slot.hour * 60 + slot.minute
                  const selected = config.timeSlots.some(
                    (s) => s.hour === slot.hour && s.minute === slot.minute
                  )
                  const h = slot.hour === 12 ? 12 : slot.hour > 12 ? slot.hour - 12 : slot.hour
                  const ampm = slot.hour >= 12 ? "PM" : "AM"
                  const timeStr = `${h}:${slot.minute.toString().padStart(2, "0")} ${ampm}`

                  // Check if this is the end button (slot right after last selected)
                  const lastSelected = config.timeSlots.length > 0 ? config.timeSlots[config.timeSlots.length - 1] : null
                  const lastMin = lastSelected ? lastSelected.hour * 60 + lastSelected.minute : -1
                  const isEndButton = lastSelected && slotMin === lastMin + 30

                  // Check if this is the first selected
                  const firstSelected = config.timeSlots.length > 0 ? config.timeSlots[0] : null
                  const isFirst = firstSelected && slot.hour === firstSelected.hour && slot.minute === firstSelected.minute

                  return (
                    <button
                      key={`${slot.hour}-${slot.minute}`}
                      onClick={() => {
                        if (config.timeSlots.length === 0) {
                          // First click: auto-select 1 hour (2 slots)
                          const nextSlot = {
                            hour: slot.minute === 30 ? slot.hour + 1 : slot.hour,
                            minute: slot.minute === 30 ? 0 : 30,
                          }
                          // Check next slot is within range (before 10 PM)
                          if (nextSlot.hour * 60 + nextSlot.minute <= 22 * 60) {
                            update({ timeSlots: [slot, nextSlot] })
                          } else {
                            update({ timeSlots: [slot] })
                          }
                          return
                        }

                        const firstMin =
                          config.timeSlots[0].hour * 60 +
                          config.timeSlots[0].minute

                        if (slotMin === firstMin) {
                          // Clicked the current START — clear so user can pick anew
                          update({ timeSlots: [] })
                          return
                        }

                        if (slotMin < firstMin) {
                          // Clicked before start — new start with 1-hour auto
                          const nextSlot = {
                            hour: slot.minute === 30 ? slot.hour + 1 : slot.hour,
                            minute: slot.minute === 30 ? 0 : 30,
                          }
                          if (nextSlot.hour * 60 + nextSlot.minute <= 22 * 60) {
                            update({ timeSlots: [slot, nextSlot] })
                          } else {
                            update({ timeSlots: [slot] })
                          }
                          return
                        }

                        // Clicked after start — extend/shrink to this as end
                        const newSlots: { hour: number; minute: number }[] = []
                        let curMin = firstMin
                        while (curMin <= slotMin) {
                          newSlots.push({
                            hour: Math.floor(curMin / 60),
                            minute: curMin % 60,
                          })
                          curMin += 30
                        }
                        update({ timeSlots: newSlots })
                      }}
                      className={cn(
                        "px-2 py-2 rounded-md text-xs font-medium transition-all relative",
                        selected
                          ? "bg-brand-orange text-white"
                          : isEndButton
                            ? "bg-brand-orange/20 text-brand-orange border border-brand-orange/50"
                            : "bg-bg-elevated text-text-secondary border border-border hover:border-brand-orange/50"
                      )}
                    >
                      {timeStr}
                      {isFirst && config.timeSlots.length > 0 && (
                        <span className="absolute -top-1.5 -left-1 text-[10px] bg-brand-orange-dark text-white px-1 rounded">
                          START
                        </span>
                      )}
                      {isEndButton && (
                        <span className="absolute -top-1.5 -right-1 text-[10px] bg-brand-orange-dark text-white px-1 rounded">
                          END
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {config.timeSlots.length >= 2 && (
                <div className="bg-bg-elevated rounded-lg border border-brand-orange/20 p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-text-secondary">Session: </span>
                    <span className="font-mono font-semibold text-text-primary">
                      {(() => {
                        const first = config.timeSlots[0]
                        const last = config.timeSlots[config.timeSlots.length - 1]
                        const endMin = last.hour * 60 + last.minute + 30
                        const fh = first.hour === 12 ? 12 : first.hour > 12 ? first.hour - 12 : first.hour
                        const eh = Math.floor(endMin / 60)
                        const ehd = eh === 12 ? 12 : eh > 12 ? eh - 12 : eh
                        return `${fh}:${first.minute.toString().padStart(2, "0")} ${first.hour >= 12 ? "PM" : "AM"} — ${ehd}:${(endMin % 60).toString().padStart(2, "0")} ${eh >= 12 ? "PM" : "AM"}`
                      })()}
                    </span>
                  </div>
                  <span className="text-sm font-display font-bold text-brand-orange">
                    {totalHoursPerSession}h
                  </span>
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger >
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-bg-elevated border-border text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(config.startDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={config.startDate}
                      onSelect={(d) => d && update({ startDate: d })}
                      disabled={(d) => d < earliest}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger >
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-bg-elevated border-border text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(config.endDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={config.endDate}
                      onSelect={(d) => d && update({ endDate: d })}
                      disabled={(d) => d <= config.startDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Quick presets */}
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "4 weeks", weeks: 4 },
                  { label: "8 weeks", weeks: 8 },
                  { label: "12 weeks", weeks: 12 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="border-border text-text-secondary text-xs"
                    onClick={() =>
                      update({
                        endDate: addWeeks(config.startDate, preset.weeks),
                      })
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {recurringDates.length > 0 && config.timeSlots.length > 0 && (
              <div className="bg-bg-elevated rounded-lg border border-brand-orange/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Info className="h-4 w-4 text-brand-orange" />
                  Recurring Summary
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-secondary">Sessions:</span>{" "}
                    <span className="font-bold">{totalSessions}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Hours each:</span>{" "}
                    <span className="font-bold">{totalHoursPerSession}h</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Frequency:</span>{" "}
                    <span className="font-bold capitalize">
                      {config.frequency}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Days:</span>{" "}
                    <span className="font-bold">
                      {config.daysOfWeek
                        .sort()
                        .map((d) => DAYS_OF_WEEK[d].label)
                        .join(", ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-text-secondary text-sm">
                    Total ({totalSessions} sessions x {totalHoursPerSession}h x{" "}
                    {formatCents(priceCentsPerHour)}/hr)
                  </span>
                  <span className="text-xl font-display font-bold text-brand-orange">
                    {formatCents(totalCents)}
                  </span>
                </div>

                {/* Date list */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
                    View all {totalSessions} dates
                  </summary>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {recurringDates.map((d, i) => (
                      <div key={i} className="font-mono text-text-secondary">
                        {format(d, "EEE, MMM d, yyyy")} ·{" "}
                        {config.timeSlots
                          .map((s) => {
                            const h = s.hour === 12 ? 12 : s.hour > 12 ? s.hour - 12 : s.hour
                            const ampm = s.hour >= 12 ? "PM" : "AM"
                            return `${h}:${s.minute.toString().padStart(2, "0")} ${ampm}`
                          })
                          .join(", ")}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

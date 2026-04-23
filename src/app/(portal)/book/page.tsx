"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useBookingStore } from "@/store/bookingStore"
import { useCartStore } from "@/store/cartStore"
import { RateSelector } from "@/components/booking/RateSelector"
import { TimeSlotGrid } from "@/components/booking/TimeSlotGrid"
import {
  RecurringOptions,
  getRecurringDates,
  type RecurringConfig,
} from "@/components/booking/RecurringOptions"
import { CartDrawer } from "@/components/cart/CartDrawer"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents } from "@/lib/utils/format"
import { format, addDays, addWeeks } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft,
  ShoppingCart,
  CheckCircle,
} from "lucide-react"
import type { Rate, TimeSlot, AvailabilityMap } from "@/types"

const defaultRecurringConfig: RecurringConfig = {
  enabled: false,
  frequency: "weekly",
  daysOfWeek: [],
  startDate: new Date(),
  endDate: addWeeks(new Date(), 4),
  timeSlots: [],
}

export default function BookPage() {
  const {
    step,
    setStep,
    selectedRate,
    setSelectedRate,
    selectedDate,
    setSelectedDate,
    selectedSlots,
    setSlots,
    toggleSlot,
    clearSlots,
    participantCount,
  } = useBookingStore()

  const { addItem } = useCartStore()
  const router = useRouter()

  const [rates, setRates] = useState<Rate[]>([])
  const [availability, setAvailability] = useState<AvailabilityMap>({})
  const [rateFilter, setRateFilter] = useState("")
  const [loadingRates, setLoadingRates] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [recurringConfig, setRecurringConfig] = useState<RecurringConfig>(
    defaultRecurringConfig
  )

  useEffect(() => {
    async function fetchRates() {
      const supabase = createClient()
      const { data } = await supabase
        .from("rates")
        .select("*")
        .eq("is_active", true)
        .neq("type", "staff_access")
        .order("sort_order")
      setRates(data || [])
      setLoadingRates(false)
    }
    fetchRates()
  }, [])

  const fetchAvailability = useCallback(async () => {
    setLoadingSlots(true)
    const start = new Date().toISOString()
    const end = addDays(new Date(), 90).toISOString()
    const res = await fetch(`/api/availability?start=${start}&end=${end}`)
    const data = await res.json()
    setAvailability(data.availability || {})
    setLoadingSlots(false)
  }, [])

  useEffect(() => {
    if (step >= 2) {
      fetchAvailability()
    }
  }, [step, fetchAvailability])

  // Single booking: add to cart
  const handleAddToCart = () => {
    if (!selectedRate || selectedSlots.length === 0) return

    addItem({
      rateId: selectedRate.id,
      rateName: selectedRate.name,
      rateType: selectedRate.type,
      priceCents: selectedRate.price_cents,
      pricePerUnit: selectedRate.per_unit,
      slots: selectedSlots,
      participantCount,
      isRecurring: false,
    })

    toast.success("Added to cart!")
    clearSlots()
  }

  // Recurring booking: add all sessions to cart
  const handleAddRecurringToCart = () => {
    if (!selectedRate) return
    if (recurringConfig.daysOfWeek.length === 0) {
      toast.error("Select at least one day of the week")
      return
    }
    if (recurringConfig.timeSlots.length === 0) {
      toast.error("Select at least one time slot")
      return
    }
    if (recurringConfig.timeSlots.length < 2) {
      toast.error("Minimum booking is 1 hour (select at least 2 time slots)")
      return
    }

    const dates = getRecurringDates(recurringConfig)
    if (dates.length === 0) {
      toast.error("No dates found in the selected range")
      return
    }

    // Build 30-min slots for each recurring date
    const allSlots = dates.flatMap((date) =>
      recurringConfig.timeSlots.map((ts) => {
        const start = new Date(date)
        start.setHours(ts.hour, ts.minute, 0, 0)
        const end = new Date(start.getTime() + 30 * 60 * 1000)
        return { start: start.toISOString(), end: end.toISOString() }
      })
    )

    addItem({
      rateId: selectedRate.id,
      rateName: selectedRate.name,
      rateType: selectedRate.type,
      priceCents: selectedRate.price_cents,
      pricePerUnit: selectedRate.per_unit,
      slots: allSlots,
      participantCount,
      isRecurring: true,
      recurringConfig: {
        frequency: recurringConfig.frequency,
        daysOfWeek: recurringConfig.daysOfWeek,
        endDate: recurringConfig.endDate.toISOString(),
      },
    })

    toast.success(
      `Added ${dates.length} recurring sessions to cart!`
    )
    setRecurringConfig(defaultRecurringConfig)
  }

  const dateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null
  const daySlots: TimeSlot[] = dateKey
    ? availability[dateKey]?.slots || []
    : []

  const selectedHours =
    selectedSlots.reduce((ms, slot) => {
      return ms + (new Date(slot.end).getTime() - new Date(slot.start).getTime())
    }, 0) / (1000 * 60 * 60)

  const estimatedTotal =
    selectedRate && selectedSlots.length > 0
      ? selectedRate.per_unit === "hour"
        ? Math.round(selectedRate.price_cents * selectedHours)
        : selectedRate.price_cents
      : 0

  return (
    <div>
      <PageHeader
        title="Book a Session"
        description="Select your booking type, date, and time"
        action={<CartDrawer />}
      />

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {["Select Type", "Choose Time", "Review"].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold ${
                step > i + 1
                  ? "bg-success text-white"
                  : step === i + 1
                    ? "bg-brand-orange text-white"
                    : "bg-bg-elevated text-text-muted"
              }`}
            >
              {step > i + 1 ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-sm hidden sm:inline ${
                step === i + 1 ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {label}
            </span>
            {i < 2 && (
              <div className="w-8 h-px bg-border hidden sm:block" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Rate */}
      {step === 1 && (
        <div className="space-y-6">
          {loadingRates ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 bg-bg-elevated rounded-lg" />
              ))}
            </div>
          ) : (
            <RateSelector
              rates={rates}
              selectedRate={selectedRate}
              onSelect={(rate) => {
                setSelectedRate(rate)
                setStep(2)
              }}
              filter={rateFilter || undefined}
            />
          )}
        </div>
      )}

      {/* Step 2: Choose Date & Time */}
      {step === 2 && (
        <div className="space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep(1)
              setRecurringConfig(defaultRecurringConfig)
            }}
            className="text-text-secondary"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Change Booking Type
          </Button>

          <div className="bg-bg-secondary rounded-lg border border-border p-4">
            <p className="text-sm text-text-secondary mb-1">Selected:</p>
            <p className="font-semibold text-brand-orange">
              {selectedRate?.name} —{" "}
              {formatCents(selectedRate?.price_cents || 0)}/
              {selectedRate?.per_unit}
            </p>
          </div>

          {/* Recurring Options */}
          <RecurringOptions
            config={recurringConfig}
            onChange={setRecurringConfig}
            priceCentsPerHour={selectedRate?.price_cents || 0}
            availability={availability}
          />

          {/* Recurring: Add to cart button */}
          {recurringConfig.enabled &&
            recurringConfig.daysOfWeek.length > 0 &&
            recurringConfig.timeSlots.length > 0 && (
              <div className="flex justify-end">
                <Button
                  onClick={handleAddRecurringToCart}
                  className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add Recurring Sessions to Cart
                </Button>
              </div>
            )}

          {/* Single booking: Calendar + Slots */}
          {!recurringConfig.enabled && (
            <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
              <div>
                <Calendar
                  mode="single"
                  selected={selectedDate || undefined}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date < new Date()}
                  className="rounded-lg border border-border bg-bg-secondary"
                />
              </div>

              <div>
                {!selectedDate && (
                  <p className="text-text-secondary text-sm py-8 text-center">
                    Select a date to see available time slots
                  </p>
                )}

                {selectedDate && loadingSlots && (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-10 w-20 bg-bg-elevated rounded inline-block mr-2"
                      />
                    ))}
                  </div>
                )}

                {selectedDate && !loadingSlots && (
                  <div className="space-y-4">
                    <h3 className="font-display font-bold uppercase tracking-wide">
                      {format(selectedDate, "EEEE, MMMM d")}
                    </h3>
                    <TimeSlotGrid
                      slots={daySlots}
                      selectedSlots={selectedSlots}
                      onSlotsChanged={setSlots}
                      maxSlots={(selectedRate?.max_hours || 10) * 2}
                      minSlots={2}
                    />

                    {selectedSlots.length >= 2 && (
                      <div className="flex items-center justify-between bg-bg-secondary rounded-lg border border-brand-orange/30 p-4">
                        <div>
                          <p className="text-sm text-text-secondary">
                            {selectedHours}h selected
                          </p>
                          <p className="text-xl font-display font-bold text-brand-orange">
                            {formatCents(estimatedTotal)}
                          </p>
                        </div>
                        <Button
                          onClick={handleAddToCart}
                          className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Add to Cart
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

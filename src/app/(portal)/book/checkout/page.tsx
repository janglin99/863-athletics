"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Elements } from "@stripe/react-stripe-js"
import { getStripe } from "@/lib/stripe/client"
import { useCartStore } from "@/store/cartStore"
import {
  StripePaymentForm,
  stripeAppearance,
} from "@/components/payment/StripePaymentForm"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatCents, formatTime, formatDate } from "@/lib/utils/format"
import { toast } from "sonner"
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  ClipboardCheck,
  DollarSign,
  Clock,
  Ticket,
  CheckCircle,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { HoldCountdown } from "@/components/booking/HoldCountdown"
import type { UserCredit } from "@/types"

export default function CheckoutPage() {
  const { items, getTotalCents, clearCart } = useCartStore()
  const router = useRouter()

  const [waiverConfirmed, setWaiverConfirmed] = useState(false)
  const [notes, setNotes] = useState("")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookingNumber, setBookingNumber] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [isInHouseTrainer, setIsInHouseTrainer] = useState(false)
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null)

  // Credits
  const [availableCredits, setAvailableCredits] = useState<UserCredit[]>([])
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null)
  const [creditApplied, setCreditApplied] = useState(false)
  const [creditDiscountCents, setCreditDiscountCents] = useState(0)
  const [creditFullyCovered, setCreditFullyCovered] = useState(false)
  const [applyingCredit, setApplyingCredit] = useState(false)

  useEffect(() => {
    async function checkTrainerStatus() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, trainer_type")
        .eq("id", user.id)
        .single()
      if (profile?.role === "trainer" && profile?.trainer_type === "in_house") {
        setIsInHouseTrainer(true)
      }

      // Load available credits
      const creditsRes = await fetch("/api/credits")
      const creditsData = await creditsRes.json()
      setAvailableCredits(creditsData.credits || [])
    }
    checkTrainerStatus()
  }, [])

  // Refresh hold on mount to reset the timer
  useEffect(() => {
    async function refreshHold() {
      const allSlots = items.flatMap((item) => item.slots)
      if (allSlots.length === 0) return
      try {
        const res = await fetch("/api/slot-holds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: allSlots }),
        })
        const data = await res.json()
        if (res.ok && data.expiresAt) {
          setHoldExpiresAt(data.expiresAt)
        }
      } catch {
        // Best-effort
      }
    }
    refreshHold()
  }, [items])

  const handleHoldExpired = useCallback(() => {
    setHoldExpiresAt(null)
    clearCart()
    toast.error("Your held slots have expired")
    router.push("/book")
  }, [clearCart, router])

  // Release holds after successful booking
  const releaseHolds = async () => {
    try {
      await fetch("/api/slot-holds", { method: "DELETE" })
    } catch {
      // Best-effort
    }
  }

  const total = getTotalCents()
  const effectiveTotal = total - creditDiscountCents

  // Calculate total hours for the booking
  const totalBookingHours = items.reduce((hrs, item) => {
    const ms = item.slots.reduce(
      (acc, s) => acc + (new Date(s.end).getTime() - new Date(s.start).getTime()),
      0
    )
    return hrs + ms / (1000 * 60 * 60)
  }, 0)

  const getCreditPreview = (credit: UserCredit) => {
    if (credit.credit_type === "dollar") {
      const applies = Math.min(Number(credit.remaining_amount) * 100, total)
      return `Applies ${formatCents(applies)} of ${formatCents(Number(credit.remaining_amount) * 100)}`
    }
    if (credit.credit_type === "hours") {
      const covers = Number(credit.remaining_amount) >= totalBookingHours
      return `${Number(credit.remaining_amount)} hours available${covers ? " — fully covers this booking" : ""}`
    }
    return `${Number(credit.remaining_amount)} sessions available — covers 1 booking`
  }

  const handleApplyCredit = async (bId: string) => {
    if (!selectedCreditId) {
      toast.error("Please select a credit to apply")
      return
    }
    setApplyingCredit(true)
    const res = await fetch("/api/credits/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: bId, creditId: selectedCreditId }),
    })
    const data = await res.json()
    if (res.ok) {
      setCreditApplied(true)
      setCreditDiscountCents(data.discountCents || 0)
      setCreditFullyCovered(data.fullyCovered || false)
      if (data.fullyCovered) {
        await releaseHolds()
        toast.success("Booking confirmed with credits!")
        clearCart()
        router.push(`/book/confirmation?booking=${bookingNumber}`)
      } else {
        toast.success(`Credit applied: -${formatCents(data.discountCents)}`)
      }
    } else {
      toast.error(data.error || "Failed to apply credit")
    }
    setApplyingCredit(false)
  }

  const createBooking = async (method: string) => {
    if (!waiverConfirmed) {
      toast.error("Please confirm the liability waiver")
      return null
    }
    if (items.length === 0) {
      toast.error("Cart is empty")
      return null
    }

    setLoading(true)

    // Create booking for first cart item (simplified — in production, support multiple)
    const item = items[0]
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rateId: item.rateId,
        slots: item.slots,
        participantCount: item.participantCount,
        notes,
        paymentMethod: method === "stripe" ? "stripe_card" : method,
        waiverConfirmed: true,
        isRecurring: false,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Failed to create booking")
      setLoading(false)
      return null
    }

    setBookingId(data.booking.id)
    setBookingNumber(data.booking.booking_number)
    return data.booking
  }

  const handleStripeCheckout = async () => {
    const booking = await createBooking(selectedCreditId ? "credit" : "stripe")
    if (!booking) return

    // If a credit is selected, apply it first
    if (selectedCreditId) {
      setApplyingCredit(true)
      const creditRes = await fetch("/api/credits/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, creditId: selectedCreditId }),
      })
      const creditData = await creditRes.json()
      if (!creditRes.ok) {
        toast.error(creditData.error || "Failed to apply credit")
        setLoading(false)
        setApplyingCredit(false)
        return
      }

      setCreditApplied(true)
      setCreditDiscountCents(creditData.discountCents || 0)
      setCreditFullyCovered(creditData.fullyCovered || false)
      setApplyingCredit(false)

      if (creditData.fullyCovered) {
        await releaseHolds()
        toast.success("Booking confirmed with credits!")
        clearCart()
        router.push(`/book/confirmation?booking=${booking.booking_number}`)
        return
      }

      toast.success(`Credit applied: -${formatCents(creditData.discountCents)}`)
    }

    // Create payment intent (for remaining amount after credits)
    const res = await fetch("/api/payments/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    })

    const data = await res.json()
    if (!res.ok) {
      toast.error("Failed to initialize payment")
      setLoading(false)
      return
    }

    setClientSecret(data.clientSecret)
    setLoading(false)
  }

  const handleTrainerBooking = async () => {
    const booking = await createBooking("trainer_account")
    if (!booking) return

    await releaseHolds()
    toast.success("Booking confirmed! Added to your monthly billing.")
    clearCart()
    router.push(`/book/confirmation?booking=${booking.booking_number}`)
  }



  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary mb-4">Your cart is empty</p>
        <Link href="/book">
          <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white">
            Browse Sessions
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Checkout"
        action={
          <HoldCountdown
            expiresAt={holdExpiresAt}
            onExpired={handleHoldExpired}
          />
        }
      />

      <Link href="/book">
        <Button variant="ghost" size="sm" className="text-text-secondary mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Booking
        </Button>
      </Link>

      {/* Order Summary */}
      <div className="bg-bg-secondary rounded-lg border border-border p-6 mb-6">
        <h3 className="font-display font-bold uppercase tracking-wide mb-4">
          Order Summary
        </h3>
        {items.map((item) => {
          const firstSlot = item.slots[0]
          const lastSlot = item.slots[item.slots.length - 1]
          const totalMs = item.slots.reduce(
            (ms, s) => ms + (new Date(s.end).getTime() - new Date(s.start).getTime()), 0
          )
          const totalHours = totalMs / (1000 * 60 * 60)
          const itemTotal = item.pricePerUnit === "hour"
            ? Math.round(item.priceCents * totalHours)
            : item.priceCents

          return (
            <div key={item.id} className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-sm">{item.rateName}</p>
                {item.isRecurring ? (
                  <p className="text-xs text-text-secondary font-mono">
                    {item.recurringConfig?.frequency} · {item.slots.length} sessions ·{" "}
                    {formatDate(firstSlot.start)} — {formatDate(lastSlot.start)}
                  </p>
                ) : (
                  <p className="text-xs text-text-secondary font-mono">
                    {formatDate(firstSlot.start)} · {formatTime(firstSlot.start)} -{" "}
                    {formatTime(lastSlot.end)} ({totalHours}h)
                  </p>
                )}
              </div>
              <span className="font-display font-bold text-brand-orange">
                {formatCents(itemTotal)}
              </span>
            </div>
          )
        })}
        <div className="border-t border-border pt-3 mt-3 space-y-1">
          <div className="flex justify-between">
            <span className="font-semibold">Subtotal</span>
            <span className="text-xl font-display font-bold text-brand-orange">
              {formatCents(total)}
            </span>
          </div>
          {creditApplied && creditDiscountCents > 0 && (
            <>
              <div className="flex justify-between text-success text-sm">
                <span>Credit applied</span>
                <span>-{formatCents(creditDiscountCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Remaining</span>
                <span className="text-xl font-display font-bold text-brand-orange">
                  {formatCents(effectiveTotal)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6 space-y-2">
        <Label>Special Requests (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special requests or notes..."
          className="bg-bg-elevated border-border"
          maxLength={500}
        />
      </div>

      {/* Waiver */}
      <div className="flex items-start gap-3 mb-6 bg-bg-secondary rounded-lg border border-border p-4">
        <Checkbox
          id="waiver"
          checked={waiverConfirmed}
          onCheckedChange={(c) => setWaiverConfirmed(c === true)}
          className="mt-1"
        />
        <Label htmlFor="waiver" className="text-sm text-text-secondary cursor-pointer">
          I have read and agree to the{" "}
          <Link href="/waiver" className="text-brand-orange hover:underline" target="_blank">
            Liability Waiver
          </Link>{" "}
          and assume all risks associated with using 863 Athletics facilities.
        </Label>
      </div>

      {/* Apply Credits */}
      {availableCredits.length > 0 && !creditApplied && !isInHouseTrainer && (
        <div className="bg-bg-secondary rounded-lg border border-border p-6 mb-6">
          <h3 className="font-display font-bold uppercase tracking-wide mb-4">
            Apply Credits
          </h3>
          <div className="space-y-3">
            {availableCredits.map((credit) => {
              const typeColor =
                credit.credit_type === "dollar"
                  ? "text-success"
                  : credit.credit_type === "hours"
                    ? "text-brand-steel"
                    : "text-brand-orange"
              const TypeIcon =
                credit.credit_type === "dollar"
                  ? DollarSign
                  : credit.credit_type === "hours"
                    ? Clock
                    : Ticket

              return (
                <label
                  key={credit.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCreditId === credit.id
                      ? "border-brand-orange bg-brand-orange/5"
                      : "border-border bg-bg-elevated hover:border-brand-orange/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="credit"
                    checked={selectedCreditId === credit.id}
                    onChange={() => setSelectedCreditId(credit.id)}
                    className="accent-brand-orange"
                  />
                  <TypeIcon className={`h-4 w-4 ${typeColor}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {credit.credit_type === "dollar"
                        ? `$${Number(credit.remaining_amount).toFixed(2)}`
                        : credit.credit_type === "hours"
                          ? `${Number(credit.remaining_amount)} hours`
                          : `${Number(credit.remaining_amount)} sessions`}
                    </p>
                    <p className="text-xs text-text-muted">
                      {getCreditPreview(credit)}
                    </p>
                    {credit.description && (
                      <p className="text-xs text-text-secondary">{credit.description}</p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
          <p className="text-xs text-text-muted mt-3">
            Credit will be applied after booking is created.
          </p>
        </div>
      )}

      {creditApplied && creditFullyCovered && (
        <div className="bg-success/10 rounded-lg border border-success/30 p-6 mb-6 text-center">
          <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
          <h3 className="font-display font-bold uppercase tracking-wide text-success">
            Covered by Credits
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            No payment needed — your credits fully cover this booking.
          </p>
        </div>
      )}

      {/* Payment Method */}
      {isInHouseTrainer ? (
        <div className="bg-bg-secondary rounded-lg border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <ClipboardCheck className="h-6 w-6 text-green-500" />
            <h3 className="font-display font-bold uppercase tracking-wide">
              Trainer Account
            </h3>
          </div>
          <p className="text-sm text-text-secondary mb-6">
            This session will be added to your monthly billing. No payment required now.
          </p>
          <Button
            onClick={handleTrainerBooking}
            disabled={loading || !waiverConfirmed}
            className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-6"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="mr-2 h-4 w-4" />
            )}
            Confirm Booking
          </Button>
        </div>
      ) : (
        <div>
          {clientSecret ? (
            <Elements
              stripe={getStripe()}
              options={{
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <StripePaymentForm
                onSuccess={() => {
                  releaseHolds()
                  clearCart()
                  router.push(
                    `/book/confirmation?booking=${bookingNumber}`
                  )
                }}
                bookingNumber={bookingNumber}
                bookingId={bookingId || ""}
              />
            </Elements>
          ) : !creditFullyCovered ? (
            <Button
              onClick={handleStripeCheckout}
              disabled={loading || applyingCredit || !waiverConfirmed}
              className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-6"
            >
              {loading || applyingCredit ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : selectedCreditId ? (
                <CheckCircle className="mr-2 h-4 w-4" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {selectedCreditId
                ? "Apply Credit & Pay Remaining"
                : `Pay ${formatCents(total)}`}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

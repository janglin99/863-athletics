"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Elements } from "@stripe/react-stripe-js"
import { getStripe } from "@/lib/stripe/client"
import { useCartStore } from "@/store/cartStore"
import {
  StripePaymentForm,
  stripeAppearance,
} from "@/components/payment/StripePaymentForm"
import { ManualPaymentInstructions } from "@/components/payment/ManualPaymentInstructions"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatCents, formatTime, formatDate } from "@/lib/utils/format"
import { toast } from "sonner"
import { ArrowLeft, Loader2, CreditCard, Smartphone, ClipboardCheck } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function CheckoutPage() {
  const { items, getTotalCents, clearCart } = useCartStore()
  const router = useRouter()

  const [paymentMethod, setPaymentMethod] = useState("stripe")
  const [waiverConfirmed, setWaiverConfirmed] = useState(false)
  const [notes, setNotes] = useState("")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookingNumber, setBookingNumber] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [isInHouseTrainer, setIsInHouseTrainer] = useState(false)

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
    }
    checkTrainerStatus()
  }, [])

  const total = getTotalCents()

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
    const booking = await createBooking("stripe")
    if (!booking) return

    // Create payment intent
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

    toast.success("Booking confirmed! Added to your monthly billing.")
    clearCart()
    router.push(`/book/confirmation?booking=${booking.booking_number}`)
  }

  const handleManualPaymentSent = async () => {
    const booking = await createBooking(paymentMethod)
    if (!booking) return

    toast.success("Booking created! We'll confirm your payment shortly.")
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
      <PageHeader title="Checkout" />

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
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-start mb-3">
            <div>
              <p className="font-semibold text-sm">{item.rateName}</p>
              {item.slots.map((slot, i) => (
                <p key={i} className="text-xs text-text-secondary font-mono">
                  {formatDate(slot.start)} · {formatTime(slot.start)} -{" "}
                  {formatTime(slot.end)}
                </p>
              ))}
            </div>
            <span className="font-display font-bold text-brand-orange">
              {formatCents(
                item.pricePerUnit === "hour"
                  ? item.priceCents * item.slots.length
                  : item.priceCents
              )}
            </span>
          </div>
        ))}
        <div className="border-t border-border pt-3 mt-3 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-display font-bold text-brand-orange">
            {formatCents(total)}
          </span>
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
        <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
          <TabsList className="bg-bg-secondary w-full">
            <TabsTrigger value="stripe" className="flex-1">
              <CreditCard className="h-4 w-4 mr-2" />
              Card / Apple Pay
            </TabsTrigger>
            <TabsTrigger value="zelle" className="flex-1">
              Zelle
            </TabsTrigger>
            <TabsTrigger value="cash_app" className="flex-1">
              <Smartphone className="h-4 w-4 mr-2" />
              Cash App
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stripe" className="mt-6">
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
                    clearCart()
                    router.push(
                      `/book/confirmation?booking=${bookingNumber}`
                    )
                  }}
                  bookingNumber={bookingNumber}
                />
              </Elements>
            ) : (
              <Button
                onClick={handleStripeCheckout}
                disabled={loading || !waiverConfirmed}
                className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-6"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Pay {formatCents(total)}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="zelle" className="mt-6">
            <ManualPaymentInstructions
              method="zelle"
              amount={total}
              bookingNumber={bookingNumber || "BK------"}
              onConfirmSent={handleManualPaymentSent}
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="cash_app" className="mt-6">
            <ManualPaymentInstructions
              method="cash_app"
              amount={total}
              bookingNumber={bookingNumber || "BK------"}
              onConfirmSent={handleManualPaymentSent}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

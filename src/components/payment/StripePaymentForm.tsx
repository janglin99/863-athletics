"use client"

import { useState } from "react"
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface StripePaymentFormProps {
  onSuccess: () => void
  bookingNumber: string
  bookingId: string
}

export function StripePaymentForm({
  onSuccess,
  bookingNumber,
  bookingId,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/book/confirmation?booking=${bookingNumber}`,
      },
      redirect: "if_required",
    })

    if (error) {
      toast.error(error.message || "Payment failed")
      setLoading(false)
      return
    }

    // Payment succeeded — confirm the booking server-side
    try {
      await fetch(`/api/bookings/${bookingId}/confirm`, {
        method: "POST",
      })
    } catch {
      // Webhook will handle it as fallback
    }

    toast.success("Payment successful!")
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-6 text-lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          "Complete Booking"
        )}
      </Button>
    </form>
  )
}

export const stripeAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#FF4700",
    colorBackground: "#1A1A1E",
    colorText: "#F5F5F7",
    colorDanger: "#EF4444",
    fontFamily: '"DM Sans", sans-serif',
    spacingUnit: "4px",
    borderRadius: "6px",
  },
}

"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { CheckCircle, Calendar, ClipboardList, Key, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Booking } from "@/types"

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingNumber = searchParams.get("booking") || "------"
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loadingCode, setLoadingCode] = useState(true)

  useEffect(() => {
    async function fetchBooking() {
      const supabase = createClient()
      const { data } = await supabase
        .from("bookings")
        .select("*, access_codes(*), slots:booking_slots(*)")
        .eq("booking_number", bookingNumber)
        .single()

      setBooking(data)
      setLoadingCode(false)

      // If no access codes yet, poll for them
      if (data && (!data.access_codes || data.access_codes.length === 0)) {
        let attempts = 0
        const interval = setInterval(async () => {
          attempts++
          const { data: updated } = await supabase
            .from("bookings")
            .select("*, access_codes(*), slots:booking_slots(*)")
            .eq("booking_number", bookingNumber)
            .single()

          if (updated?.access_codes && updated.access_codes.length > 0) {
            setBooking(updated)
            clearInterval(interval)
          }
          if (attempts >= 10) clearInterval(interval)
        }, 5000)

        return () => clearInterval(interval)
      }
    }
    if (bookingNumber !== "------") fetchBooking()
  }, [bookingNumber])

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("Access code copied!")
  }

  const activeCode = booking?.access_codes?.find(
    (c) => c.status === "active" && c.pin_code !== "GENERATING" && c.pin_code !== "MANUAL_REQUIRED"
  )
  const pendingCode = booking?.access_codes?.find(
    (c) => c.status === "pending" || c.pin_code === "GENERATING"
  )

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="animate-[fadeUp_0.4s_ease-out_forwards]">
        <div className="rounded-full bg-success/10 p-6 mx-auto w-fit mb-6">
          <CheckCircle className="h-16 w-16 text-success" />
        </div>

        <h1 className="text-4xl font-display font-bold uppercase tracking-wide mb-2">
          Booking Confirmed!
        </h1>

        <p className="text-text-secondary mb-8">
          Your session has been booked successfully.
        </p>

        <div className="bg-bg-secondary rounded-lg border border-border p-6 mb-6">
          <p className="text-sm text-text-muted mb-1">Booking Number</p>
          <p className="text-4xl font-mono font-bold text-brand-orange tracking-widest">
            {bookingNumber}
          </p>
        </div>

        {/* Access Code */}
        {activeCode && (
          <div className="bg-bg-secondary rounded-lg border border-success/30 p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Key className="h-5 w-5 text-success" />
              <p className="text-sm font-semibold text-success">Your Access Code</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-mono font-bold tracking-[0.3em] text-success">
                {activeCode.pin_code}
              </span>
              <button
                onClick={() => copyCode(activeCode.pin_code)}
                className="text-text-muted hover:text-text-primary"
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-text-muted mt-3">
              Enter this code on the lockbox keypad. Valid for your session time only. Do not share.
            </p>
          </div>
        )}

        {pendingCode && !activeCode && (
          <div className="bg-bg-secondary rounded-lg border border-warning/30 p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Loader2 className="h-5 w-5 text-warning animate-spin" />
              <p className="text-sm font-semibold text-warning">Generating Access Code...</p>
            </div>
            <p className="text-xs text-text-muted">
              Your access code is being generated. It will appear here and on your booking details page shortly.
            </p>
          </div>
        )}

        {!activeCode && !pendingCode && !loadingCode && booking && (
          <div className="bg-bg-secondary rounded-lg border border-border p-6 mb-6">
            <p className="text-sm text-text-muted">
              Your access code will be available on your booking details page before your session.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/bookings">
            <Button
              variant="outline"
              className="border-border text-text-primary w-full sm:w-auto"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              View My Bookings
            </Button>
          </Link>
          <Link href="/book">
            <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white w-full sm:w-auto">
              <Calendar className="mr-2 h-4 w-4" />
              Book Another Session
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  )
}

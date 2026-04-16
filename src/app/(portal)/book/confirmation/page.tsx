"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle, Calendar, ClipboardList } from "lucide-react"

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const bookingNumber = searchParams.get("booking") || "------"

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
          Your session has been booked. You&apos;ll receive a confirmation email
          and your access code shortly.
        </p>

        <div className="bg-bg-secondary rounded-lg border border-border p-6 mb-8">
          <p className="text-sm text-text-muted mb-1">Booking Number</p>
          <p className="text-4xl font-mono font-bold text-brand-orange tracking-widest">
            {bookingNumber}
          </p>
          <p className="text-xs text-text-muted mt-3">
            Your access code will arrive via text and email before your session
          </p>
        </div>

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

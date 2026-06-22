"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function SubscribePage() {
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [smsConsent, setSmsConsent] = useState(false)
  const [tosConsent, setTosConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const canSubmit = email.trim() !== "" && smsConsent && tosConsent && !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)

    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, smsConsent }),
    })

    setLoading(false)

    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error ?? "Something went wrong. Please try again.")
      return
    }

    setDone(true)
  }

  return (
    <div className="pt-24 pb-16 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md mx-auto px-4">
        <div className="border-2 border-dashed border-border rounded-2xl p-8 bg-bg-secondary">
          {done ? (
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-text-primary">You&apos;re subscribed!</p>
              <p className="text-sm text-text-secondary">
                You&apos;ll receive account updates and security alerts from 863 Athletics.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-text-primary mb-1">863 Athletics</h1>
              <p className="text-sm text-text-secondary mb-6">
                Sign up to receive account updates and security alerts. Choose how you&apos;d
                like to hear from us.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-bg-elevated border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Mobile Phone Number (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-bg-elevated border-border"
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="sms-consent"
                    checked={smsConsent}
                    onCheckedChange={(v) => setSmsConsent(v === true)}
                    className="mt-0.5 shrink-0"
                  />
                  <Label htmlFor="sms-consent" className="text-sm text-text-secondary leading-snug cursor-pointer">
                    By checking, you consent to receive{" "}
                    <strong className="text-text-primary">
                      account updates and security alerts from 863 Athletics
                    </strong>
                    . Message frequency may vary. Message and data rates may apply.{" "}
                    <strong className="text-text-primary">
                      Reply HELP for help or STOP to opt-out.
                    </strong>
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="tos-consent"
                    checked={tosConsent}
                    onCheckedChange={(v) => setTosConsent(v === true)}
                    className="mt-0.5 shrink-0"
                  />
                  <Label htmlFor="tos-consent" className="text-sm text-text-secondary leading-snug cursor-pointer">
                    By checking, I accept{" "}
                    <Link href="/terms" className="text-brand-orange hover:underline">
                      Terms of Service
                    </Link>{" "}
                    &amp;{" "}
                    <Link href="/privacy" className="text-brand-orange hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Subscribe
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

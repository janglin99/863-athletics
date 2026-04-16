"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { Loader2, FileText, CheckCircle } from "lucide-react"

const WAIVER_TEXT = `ASSUMPTION OF RISK, WAIVER OF LIABILITY, AND INDEMNITY AGREEMENT

863 Athletics — Lakeland, Florida

In consideration of being allowed to participate in any activities, use of equipment, services, and/or facilities at 863 Athletics ("the Facility"), I, the undersigned, acknowledge, appreciate, and agree that:

1. ASSUMPTION OF RISK: I understand that participation in physical exercise, use of gym equipment, and training activities involves risks of injury. These risks include, but are not limited to: muscle strains, sprains, fractures, heart attacks, and other physical injuries that may result from exercise, use of equipment, or the actions of others. I knowingly and freely assume all such risks, both known and unknown, and assume full responsibility for my participation.

2. WAIVER AND RELEASE: I, for myself and on behalf of my heirs, assigns, personal representatives, and next of kin, hereby release, waive, discharge, and covenant not to sue 863 Athletics, its owners, officers, employees, trainers, agents, and volunteers (collectively "Releasees") from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury, including death, that may be sustained by me while participating in any activities at the Facility.

3. INDEMNIFICATION: I agree to indemnify and hold harmless the Releasees from any loss, liability, damage, or cost they may incur due to my participation in activities at the Facility, whether caused by negligence of the Releasees or otherwise.

4. MEDICAL ACKNOWLEDGMENT: I certify that I am physically fit, have no medical condition that would prevent my participation, and have not been advised by a physician not to participate. I agree that it is my responsibility to consult a physician before beginning any exercise program.

5. FACILITY RULES: I agree to abide by all rules and regulations of the Facility, including proper use of equipment, cleanliness standards, and respect for other members and staff.

6. ACCESS CODE RESPONSIBILITY: I understand that access codes provided to me are for my personal use only during my booked session time. I agree not to share my access code with anyone. I am responsible for securing the facility upon departure.

7. PHOTO/VIDEO CONSENT: I grant 863 Athletics permission to use any photographs or video taken during my sessions for marketing purposes, unless I opt out in writing.

This agreement shall be binding upon me, my heirs, executors, administrators, and assigns. I have read this agreement, fully understand its terms, and understand that I am giving up substantial rights by signing it. I sign it freely and voluntarily without any inducement.

Governing Law: This agreement shall be governed by the laws of the State of Florida.`

export default function WaiverPage() {
  const [agreed, setAgreed] = useState(false)
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [signed, setSigned] = useState(false)
  const router = useRouter()

  const handleSign = async () => {
    if (!agreed || !fullName.trim()) {
      toast.error("Please read, agree, and type your full name")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase
        .from("profiles")
        .update({
          waiver_signed: true,
          waiver_signed_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    }

    setSigned(true)
    setLoading(false)
    toast.success("Waiver signed successfully!")
  }

  if (signed) {
    return (
      <div className="pt-24 pb-16 max-w-2xl mx-auto px-4 text-center">
        <div className="rounded-full bg-success/10 p-6 mx-auto w-fit mb-6">
          <CheckCircle className="h-16 w-16 text-success" />
        </div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-wide mb-4">
          Waiver Signed
        </h1>
        <p className="text-text-secondary mb-8">
          Thank you for signing the liability waiver. You&apos;re all set to
          book your sessions.
        </p>
        <Button
          onClick={() => router.push("/book")}
          className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
        >
          Book a Session
        </Button>
      </div>
    )
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold uppercase tracking-wide mb-4">
            Liability <span className="text-brand-orange">Waiver</span>
          </h1>
          <p className="text-text-secondary">
            Please read and sign before your first session
          </p>
        </div>

        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display uppercase tracking-wide">
              <FileText className="h-5 w-5" />
              863 Athletics Liability Waiver
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScrollArea className="h-80 rounded-lg border border-border bg-bg-elevated p-4">
              <pre className="whitespace-pre-wrap text-sm text-text-secondary font-sans leading-relaxed">
                {WAIVER_TEXT}
              </pre>
            </ScrollArea>

            <div className="flex items-start gap-3">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(c) => setAgreed(c === true)}
                className="mt-1"
              />
              <Label
                htmlFor="agree"
                className="text-sm text-text-secondary cursor-pointer"
              >
                I have read, understand, and agree to the terms of this
                Assumption of Risk, Waiver of Liability, and Indemnity
                Agreement.
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Type your full name to sign</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="bg-bg-elevated border-border font-mono text-lg"
              />
              <p className="text-xs text-text-muted">
                Date: {new Date().toLocaleDateString("en-US")}
              </p>
            </div>

            <Button
              onClick={handleSign}
              disabled={loading || !agreed || !fullName.trim()}
              className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-6"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign Waiver
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

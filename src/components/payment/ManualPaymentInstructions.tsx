"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCents } from "@/lib/utils/format"
import { Loader2, Copy, CheckCircle, Clock } from "lucide-react"
import { toast } from "sonner"

interface ManualPaymentInstructionsProps {
  method: "zelle" | "cash_app"
  amount: number
  bookingNumber: string
  onConfirmSent: () => void
  loading?: boolean
}

const instructions = {
  zelle: {
    title: "Pay via Zelle",
    account: "pay@863athletics.com",
    accountLabel: "Zelle Email",
    steps: [
      "Open your banking app or Zelle app",
      "Send payment to the email below",
      "Use your booking number as the memo",
      "Come back here and confirm you sent it",
    ],
  },
  cash_app: {
    title: "Pay via Cash App",
    account: "$863Athletics",
    accountLabel: "Cash App Tag",
    steps: [
      "Open Cash App",
      "Send payment to the tag below",
      "Add your booking number in the note",
      "Come back here and confirm you sent it",
    ],
  },
}

export function ManualPaymentInstructions({
  method,
  amount,
  bookingNumber,
  onConfirmSent,
  loading,
}: ManualPaymentInstructionsProps) {
  const [copied, setCopied] = useState(false)
  const info = instructions[method]

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="bg-bg-secondary border-border">
      <CardHeader>
        <CardTitle className="font-display uppercase tracking-wide">
          {info.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Amount */}
        <div className="text-center py-4 bg-bg-elevated rounded-lg">
          <p className="text-sm text-text-secondary mb-1">Amount Due</p>
          <p className="text-3xl font-display font-bold text-brand-orange">
            {formatCents(amount)}
          </p>
        </div>

        {/* Steps */}
        <ol className="space-y-3">
          {info.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-brand-orange text-white text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-text-secondary">{step}</span>
            </li>
          ))}
        </ol>

        {/* Account info */}
        <div className="bg-bg-elevated rounded-lg p-4">
          <p className="text-xs text-text-muted mb-1">{info.accountLabel}</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg text-text-primary">
              {info.account}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(info.account)}
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Memo: <span className="font-mono text-text-primary">{bookingNumber}</span>
          </p>
        </div>

        {/* Timer notice */}
        <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3">
          <Clock className="h-4 w-4 shrink-0" />
          <p>Your booking is held for 2 hours pending payment confirmation.</p>
        </div>

        <Button
          onClick={onConfirmSent}
          disabled={loading}
          className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-6"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          I&apos;ve Sent Payment
        </Button>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <Card className="bg-bg-secondary border-border">
        <CardContent className="pt-8 text-center">
          <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
          <h2 className="text-xl font-display uppercase tracking-wide mb-2">
            Check Your Email
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            We sent a password reset link to <strong>{email}</strong>
          </p>
          <Link href="/login">
            <Button variant="outline" className="border-border text-text-primary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-bg-secondary border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-display uppercase tracking-wide">
          Reset Password
        </CardTitle>
        <p className="text-text-secondary text-sm">
          Enter your email and we&apos;ll send a reset link
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link href="/login" className="text-brand-orange hover:underline font-medium">
            <ArrowLeft className="inline h-3 w-3 mr-1" />
            Back to Login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

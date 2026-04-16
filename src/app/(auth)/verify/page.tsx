import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"

export default function VerifyPage() {
  return (
    <Card className="bg-bg-secondary border-border">
      <CardContent className="pt-8 text-center">
        <div className="rounded-full bg-brand-orange/10 p-4 mx-auto w-fit mb-4">
          <Mail className="h-10 w-10 text-brand-orange" />
        </div>
        <h2 className="text-2xl font-display uppercase tracking-wide mb-2">
          Check Your Email
        </h2>
        <p className="text-text-secondary text-sm mb-6 max-w-sm mx-auto">
          We sent you a verification link. Click the link in your email to
          activate your account and start booking.
        </p>
        <Link href="/login">
          <Button
            variant="outline"
            className="border-border text-text-primary"
          >
            Back to Login
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

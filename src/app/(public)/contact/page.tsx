"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { MapPin, Phone, Mail, Clock, Loader2, Send } from "lucide-react"

export default function ContactPage() {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    // In production, wire this to an API route that sends via Resend
    await new Promise((r) => setTimeout(r, 1000))
    toast.success("Message sent! We'll get back to you within 24 hours.")
    setLoading(false)
    ;(e.target as HTMLFormElement).reset()
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-display font-bold uppercase tracking-wide mb-4">
            Get in <span className="text-brand-orange">Touch</span>
          </h1>
          <p className="text-text-secondary text-lg">
            Questions about booking, training, or the facility? We&apos;re here
            to help.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Contact Info */}
          <div className="space-y-6">
            {[
              {
                icon: MapPin,
                title: "Location",
                lines: ["Lakeland, FL", "Full address provided upon booking"],
              },
              {
                icon: Phone,
                title: "Phone",
                lines: ["(863) 555-0863", "Mon-Fri 8am-8pm ET"],
              },
              {
                icon: Mail,
                title: "Email",
                lines: [
                  "info@863athletics.com",
                  "We respond within 24 hours",
                ],
              },
              {
                icon: Clock,
                title: "Hours",
                lines: [
                  "Mon-Fri: 6:00 AM - 10:00 PM",
                  "Saturday: 7:00 AM - 8:00 PM",
                  "Sunday: 8:00 AM - 8:00 PM",
                ],
              },
            ].map((item) => (
              <Card
                key={item.title}
                className="bg-bg-secondary border-border"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-md bg-brand-orange/10 p-2.5 shrink-0">
                      <item.icon className="h-5 w-5 text-brand-orange" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      {item.lines.map((line, i) => (
                        <p
                          key={i}
                          className="text-sm text-text-secondary"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact Form */}
          <Card className="bg-bg-secondary border-border">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wide">
                Send Us a Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      required
                      className="bg-bg-elevated border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      required
                      className="bg-bg-elevated border-border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    className="bg-bg-elevated border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    required
                    rows={5}
                    className="bg-bg-elevated border-border"
                    placeholder="How can we help?"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

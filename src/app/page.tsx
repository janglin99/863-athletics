"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { createClient } from "@/lib/supabase/client"
import { formatCents } from "@/lib/utils/format"
import type { Rate } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  Calendar,
  Shield,
  Key,
  Dumbbell,
  Users,
  Clock,
  MapPin,
  Star,
  ArrowRight,
  Zap,
  Timer,
} from "lucide-react"

function AnimatedCounter({
  target,
  suffix = "",
}: {
  target: number
  suffix?: string
}) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const duration = 1500
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [started, target])

  return (
    <div ref={ref} className="text-4xl font-display font-bold text-brand-orange">
      {count.toLocaleString()}
      {suffix}
    </div>
  )
}

export default function HomePage() {
  const [rates, setRates] = useState<Rate[]>([])

  useEffect(() => {
    async function fetchRates() {
      const supabase = createClient()
      const { data } = await supabase
        .from("rates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .limit(4)
      setRates(data || [])
    }
    fetchRates()
  }, [])

  return (
    <>
    <Navbar />
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-primary via-[#1A0A00] to-bg-primary" />
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]" />

        {/* Diagonal accent */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-r from-brand-orange/10 to-transparent skew-y-[-2deg] origin-bottom-left" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display font-black uppercase tracking-tight leading-none mb-6">
            Train Harder.
            <br />
            <span className="text-brand-orange">Book Smarter.</span>
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10">
            863 Athletics — Haines City&apos;s premier training facility. Book your
            hour. Get your code. Walk in and work.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/book">
              <Button
                size="lg"
                className="bg-brand-orange hover:bg-brand-orange-dark text-white font-bold text-lg px-8 py-6 animate-[pulseOrange_2s_infinite]"
              >
                Book Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-text-primary text-lg px-8 py-6"
              >
                View Pricing
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div>
              <AnimatedCounter target={1200} suffix="+" />
              <p className="text-sm text-text-secondary mt-1">
                Sessions Booked
              </p>
            </div>
            <div>
              <div className="text-4xl font-display font-bold text-brand-orange">
                24/7
              </div>
              <p className="text-sm text-text-secondary mt-1">Access</p>
            </div>
            <div>
              <AnimatedCounter target={15} suffix="+" />
              <p className="text-sm text-text-secondary mt-1">
                Expert Trainers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-bg-primary">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl font-display font-bold uppercase tracking-wide text-center mb-16">
            How It <span className="text-brand-orange">Works</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                icon: Calendar,
                title: "Pick Your Time",
                desc: "Browse our real-time availability calendar and select the hours that work for you.",
              },
              {
                step: 2,
                icon: Shield,
                title: "Pay Securely",
                desc: "Pay with card, Apple Pay, Google Pay, Zelle, or Cash App. Instant confirmation.",
              },
              {
                step: 3,
                icon: Key,
                title: "Get Your Code",
                desc: "Receive a unique access code via text and email. Walk in and start training.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-bg-secondary border border-border rounded-lg text-center p-6 pt-10 relative group hover:border-brand-orange/50 transition-all overflow-hidden"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-8 w-8 rounded-b-lg bg-brand-orange text-white flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <div className="rounded-full bg-brand-orange/10 p-4 mx-auto w-fit mb-4">
                  <item.icon className="h-8 w-8 text-brand-orange" />
                </div>
                <h3 className="text-xl font-display font-bold uppercase tracking-wide mb-2">
                  {item.title}
                </h3>
                <p className="text-text-secondary text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facilities */}
      <section className="py-24 bg-bg-secondary">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl font-display font-bold uppercase tracking-wide text-center mb-16">
            The <span className="text-brand-orange">Facility</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Dumbbell,
                title: "Training Equipment",
                desc: "Shooting machine, Vertimax, regulation basketball goal, and more — everything you need to train at the highest level.",
              },
              {
                icon: MapPin,
                title: "1,500 sq ft",
                desc: "Purpose-built, air-conditioned training space designed for focused sessions.",
              },
              {
                icon: Users,
                title: "Expert Trainers",
                desc: "Certified trainers for 1-on-1 and group sessions.",
              },
              {
                icon: Clock,
                title: "Flexible Hours",
                desc: "Open early to late, 7 days a week. Train on your schedule.",
              },
              {
                icon: Zap,
                title: "Private Sessions",
                desc: "Book the entire facility for focused, uninterrupted training.",
              },
              {
                icon: Timer,
                title: "No Contracts",
                desc: "Pay per session, buy packs, or go monthly. No commitment required.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-bg-elevated border border-border rounded-lg p-5 hover:border-brand-orange/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-brand-orange/10 p-2 shrink-0 group-hover:bg-brand-orange/20 transition-colors">
                    <item.icon className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-text-secondary">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 bg-bg-primary">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl font-display font-bold uppercase tracking-wide text-center mb-4">
            Simple <span className="text-brand-orange">Pricing</span>
          </h2>
          <p className="text-text-secondary text-center mb-16 max-w-lg mx-auto">
            No hidden fees. No long-term contracts. Pay for what you use.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {rates.map((rate, i) => (
              <div
                key={rate.id}
                className={`bg-bg-secondary border border-border rounded-lg p-6 pt-8 text-center relative ${
                  i === 0 ? "border-brand-orange ring-1 ring-brand-orange/30" : ""
                }`}
              >
                {i === 0 && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-brand-orange text-white text-xs font-bold px-3 py-1 rounded-b-lg">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-display font-bold uppercase tracking-wide text-lg mb-2">
                  {rate.name}
                </h3>
                <p className="text-3xl font-display font-bold text-brand-orange">
                  {formatCents(rate.price_cents)}
                </p>
                <p className="text-sm text-text-muted mt-1">/{rate.per_unit}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing">
              <Button
                variant="outline"
                className="border-border text-text-primary"
              >
                View All Pricing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-bg-secondary">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl font-display font-bold uppercase tracking-wide text-center mb-16">
            What Athletes <span className="text-brand-orange">Say</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Marcus J.",
                quote:
                  "The booking system is next level. Pick a time, pay, get a code, walk in. No hassle.",
                rating: 5,
              },
              {
                name: "Sarah T.",
                quote:
                  "Best gym in Haines City. The trainers know their stuff and the equipment is top-notch.",
                rating: 5,
              },
              {
                name: "David R.",
                quote:
                  "I love the flexibility. No contract, just pay per session. The 10-pack is a great deal.",
                rating: 5,
              },
            ].map((review) => (
              <Card
                key={review.name}
                className="bg-bg-elevated border-border backdrop-blur-sm"
              >
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-brand-orange text-brand-orange"
                      />
                    ))}
                  </div>
                  <p className="text-text-secondary text-sm mb-4 italic">
                    &ldquo;{review.quote}&rdquo;
                  </p>
                  <p className="font-semibold text-sm">{review.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-brand-orange">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-display font-bold uppercase tracking-wide text-white mb-6">
            Ready to Train?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Create your account and book your first session in under 2 minutes.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-white text-brand-orange hover:bg-white/90 font-bold text-lg px-10 py-6"
            >
              Create Your Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
    <Footer />
    </>
  )
}

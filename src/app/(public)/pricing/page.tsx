"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents } from "@/lib/utils/format"
import { ArrowRight, Check } from "lucide-react"
import type { Rate } from "@/types"

export default function PricingPage() {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("rates")
        .select("*")
        .eq("is_active", true)
        .neq("type", "staff_access")
        .order("sort_order")
      setRates(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const categories = [
    {
      title: "Open Gym",
      description: "Drop in and train on your own schedule",
      types: ["drop_in_1hr", "drop_in_multi", "day_pass"],
    },
    {
      title: "Personal Training",
      description: "Train with a certified expert",
      types: ["trainer_private", "trainer_group_small", "trainer_group_large"],
    },
    {
      title: "Packages & Memberships",
      description: "Save with pre-paid sessions or monthly access",
      types: ["pack_5", "pack_10", "membership_monthly"],
    },
  ]

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-display font-bold uppercase tracking-wide mb-4">
            Simple, Transparent{" "}
            <span className="text-brand-orange">Pricing</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-lg mx-auto">
            No hidden fees. No contracts. Pay for what you use.
          </p>
        </div>

        {loading ? (
          <div className="space-y-12">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-8 w-48 bg-bg-elevated mb-4" />
                <div className="grid sm:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton
                      key={j}
                      className="h-40 bg-bg-elevated rounded-lg"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-16">
            {categories.map((cat) => {
              const catRates = rates.filter((r) =>
                cat.types.includes(r.type)
              )
              if (catRates.length === 0) return null

              return (
                <div key={cat.title}>
                  <h2 className="text-2xl font-display font-bold uppercase tracking-wide mb-2">
                    {cat.title}
                  </h2>
                  <p className="text-text-secondary mb-6">{cat.description}</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catRates.map((rate) => {
                      const isPopular = rate.type === "pack_10"
                      return (
                        <Card
                          key={rate.id}
                          className={`bg-bg-secondary border-border relative ${
                            isPopular
                              ? "border-brand-orange ring-1 ring-brand-orange/30"
                              : ""
                          }`}
                        >
                          {isPopular && (
                            <Badge className="absolute -top-2.5 right-4 bg-brand-orange text-white border-0">
                              BEST VALUE
                            </Badge>
                          )}
                          <CardContent className="pt-6">
                            <h3 className="font-semibold mb-1">{rate.name}</h3>
                            <p className="text-sm text-text-secondary mb-4">
                              {rate.description}
                            </p>
                            <div className="flex items-baseline gap-1 mb-4">
                              <span
                                className="text-3xl font-display font-bold"
                                style={{ color: rate.color_hex }}
                              >
                                {formatCents(rate.price_cents)}
                              </span>
                              <span className="text-sm text-text-muted">
                                /{rate.per_unit}
                              </span>
                            </div>
                            <ul className="space-y-1 mb-4">
                              {rate.max_hours && (
                                <li className="flex items-center gap-2 text-sm text-text-secondary">
                                  <Check className="h-3 w-3 text-success" />
                                  Up to {rate.max_hours} hours
                                </li>
                              )}
                              {rate.max_people > 1 && (
                                <li className="flex items-center gap-2 text-sm text-text-secondary">
                                  <Check className="h-3 w-3 text-success" />
                                  {rate.min_people}-{rate.max_people} people
                                </li>
                              )}
                              <li className="flex items-center gap-2 text-sm text-text-secondary">
                                <Check className="h-3 w-3 text-success" />
                                Instant access code
                              </li>
                            </ul>
                            <Link href="/book">
                              <Button
                                className={`w-full ${
                                  isPopular
                                    ? "bg-brand-orange hover:bg-brand-orange-dark text-white"
                                    : "bg-bg-elevated hover:bg-bg-hover text-text-primary"
                                }`}
                              >
                                Book Now
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Payment Methods */}
        <div className="mt-16 text-center bg-bg-secondary rounded-lg border border-border p-8">
          <h3 className="text-xl font-display font-bold uppercase tracking-wide mb-4">
            We Accept
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-6 text-text-secondary">
            {[
              "Visa",
              "Mastercard",
              "Apple Pay",
              "Google Pay",
              "Zelle",
              "Cash App",
            ].map((method) => (
              <span key={method} className="text-sm font-medium">
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Dumbbell,
  Target,
  Users,
  Trophy,
  ArrowRight,
} from "lucide-react"

export default function AboutPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-display font-bold uppercase tracking-wide mb-4">
            About <span className="text-brand-orange">863 Athletics</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            We built 863 Athletics for serious athletes who want a premium
            training experience without the corporate gym nonsense. No crowds.
            No waiting. Just you and the iron.
          </p>
        </div>

        {/* Values */}
        <div className="grid sm:grid-cols-2 gap-6 mb-16">
          {[
            {
              icon: Target,
              title: "Our Mission",
              desc: "To provide Haines City's most focused, efficient, and accessible training environment. Every decision we make — from equipment selection to scheduling — serves one goal: your progress.",
            },
            {
              icon: Dumbbell,
              title: "The Facility",
              desc: "3,500 square feet of carefully curated training space. Premium equipment from Rogue, Eleiko, and Hammer Strength. Dedicated zones for powerlifting, functional training, and cardio.",
            },
            {
              icon: Users,
              title: "Community",
              desc: "We're not a franchise. We're a local facility built by athletes, for athletes. Our trainers are nationally certified and genuinely invested in your success.",
            },
            {
              icon: Trophy,
              title: "No Barriers",
              desc: "No long-term contracts, no sign-up fees, no cancellation penalties. Book a single session or commit to a monthly plan. You're in control.",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="pt-6">
                <div className="rounded-md bg-brand-orange/10 p-3 w-fit mb-4">
                  <item.icon className="h-6 w-6 text-brand-orange" />
                </div>
                <h3 className="text-xl font-display font-bold uppercase tracking-wide mb-2">
                  {item.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {item.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center bg-bg-secondary rounded-lg border border-border p-12">
          <h2 className="text-3xl font-display font-bold uppercase tracking-wide mb-4">
            Come See for Yourself
          </h2>
          <p className="text-text-secondary mb-6">
            Book a session and experience the difference.
          </p>
          <Link href="/book">
            <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold px-8">
              Book a Session
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

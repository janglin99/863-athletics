import Link from "next/link"
import { Dumbbell, MapPin, Phone, Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-bg-secondary border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Dumbbell className="h-6 w-6 text-brand-orange" />
              <span className="text-lg font-display font-bold uppercase tracking-wide">
                863 Athletics
              </span>
            </div>
            <p className="text-text-secondary text-sm max-w-sm">
              Lakeland&apos;s premier training facility. Book your session,
              get your access code, and train on your schedule.
            </p>
            <div className="flex flex-col gap-2 mt-4 text-sm text-text-secondary">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Lakeland, FL</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>(863) 555-0863</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>info@863athletics.com</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-bold uppercase tracking-wide mb-4">
              Quick Links
            </h4>
            <div className="flex flex-col gap-2">
              {[
                { href: "/pricing", label: "Pricing" },
                { href: "/about", label: "About Us" },
                { href: "/contact", label: "Contact" },
                { href: "/waiver", label: "Liability Waiver" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-text-secondary hover:text-brand-orange transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Members */}
          <div>
            <h4 className="font-display font-bold uppercase tracking-wide mb-4">
              Members
            </h4>
            <div className="flex flex-col gap-2">
              {[
                { href: "/login", label: "Login" },
                { href: "/register", label: "Create Account" },
                { href: "/book", label: "Book a Session" },
                { href: "/dashboard", label: "My Dashboard" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-text-secondary hover:text-brand-orange transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-text-muted">
          &copy; {new Date().getFullYear()} 863 Athletics. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

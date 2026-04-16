"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Dumbbell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-bg-primary/80 backdrop-blur-xl border-b border-border"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Dumbbell className="h-7 w-7 text-brand-orange" />
            <span className="text-xl font-display font-bold uppercase tracking-wide">
              863 Athletics
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "text-brand-orange"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-text-secondary hover:text-text-primary"
              >
                Login
              </Button>
            </Link>
            <Link href="/book">
              <Button className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold">
                Book Now
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-bg-primary z-40">
          <div className="flex flex-col items-center pt-12 gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "text-2xl font-display font-bold uppercase tracking-wide",
                  pathname === link.href
                    ? "text-brand-orange"
                    : "text-text-primary"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 mt-8 w-64">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button
                  variant="outline"
                  className="w-full border-border text-text-primary"
                >
                  Login
                </Button>
              </Link>
              <Link href="/book" onClick={() => setMobileOpen(false)}>
                <Button className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold">
                  Book Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

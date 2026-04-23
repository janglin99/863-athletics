"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCheck,
  Calendar,
  DollarSign,
  Tag,
  Key,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "All Bookings", icon: ClipboardList },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/trainers", label: "Trainers", icon: UserCheck },
  { href: "/admin/availability", label: "Availability", icon: Calendar },
  { href: "/admin/rates", label: "Rates & Pricing", icon: Settings },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Tag },
  { href: "/admin/payments", label: "Payments", icon: DollarSign },
  { href: "/admin/access-codes", label: "Access Codes", icon: Key },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
]

export function AdminMobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <>
      {/* Top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-bg-secondary border-b border-border z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand-orange" />
          <span className="font-display font-bold uppercase tracking-wide text-sm">
            863 Admin
          </span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 text-text-secondary"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Full screen menu overlay */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 top-[52px] bg-bg-primary z-40 overflow-y-auto">
          <nav className="flex flex-col p-4 gap-1">
            {adminLinks.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-orange/10 text-brand-orange"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              )
            })}

            <div className="border-t border-border mt-4 pt-4 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <LayoutDashboard className="h-5 w-5" />
                Customer Portal
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  handleLogout()
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-text-secondary hover:text-error hover:bg-bg-hover transition-colors w-full text-left"
              >
                <LogOut className="h-5 w-5" />
                Log Out
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}

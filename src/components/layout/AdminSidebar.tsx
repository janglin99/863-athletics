"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Calendar,
  DollarSign,
  Tag,
  Key,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "All Bookings", icon: ClipboardList },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/availability", label: "Availability", icon: Calendar },
  { href: "/admin/rates", label: "Rates & Pricing", icon: Settings },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Tag },
  { href: "/admin/payments", label: "Payments", icon: DollarSign },
  { href: "/admin/access-codes", label: "Access Codes", icon: Key },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-bg-secondary border-r border-border min-h-screen p-4">
      <div className="flex items-center gap-2 mb-8 px-3">
        <Shield className="h-6 w-6 text-brand-orange" />
        <span className="font-display font-bold uppercase tracking-wide">
          863 Admin
        </span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {links.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
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
      </nav>

      <div className="border-t border-border pt-4 mt-4 space-y-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <LayoutDashboard className="h-5 w-5" />
          Customer Portal
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:text-error hover:bg-bg-hover transition-colors w-full text-left"
        >
          <LogOut className="h-5 w-5" />
          Log Out
        </button>
      </div>
    </aside>
  )
}

"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  CalendarPlus,
  ClipboardList,
  CreditCard,
  User,
  LogOut,
  Dumbbell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/book", label: "Book Time", icon: CalendarPlus },
  { href: "/bookings", label: "My Bookings", icon: ClipboardList },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: User },
]

export function PortalSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-bg-secondary border-r border-border min-h-screen p-4">
      <Link href="/" className="flex items-center gap-2 mb-8 px-3">
        <Dumbbell className="h-6 w-6 text-brand-orange" />
        <span className="font-display font-bold uppercase tracking-wide">
          863 Athletics
        </span>
      </Link>

      <nav className="flex flex-col gap-1 flex-1">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href)
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

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:text-error hover:bg-bg-hover transition-colors"
      >
        <LogOut className="h-5 w-5" />
        Log Out
      </button>
    </aside>
  )
}

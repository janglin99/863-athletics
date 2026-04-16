"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarPlus,
  ClipboardList,
  CreditCard,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/book", label: "Book", icon: CalendarPlus },
  { href: "/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/payments", label: "Pay", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: User },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border z-50">
      <div className="flex items-center justify-around py-2">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                isActive ? "text-brand-orange" : "text-text-secondary"
              )}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

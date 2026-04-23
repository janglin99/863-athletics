"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  CalendarPlus,
  ClipboardList,
  CreditCard,
  User,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const portalLinks = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/book", label: "Book", icon: CalendarPlus },
  { href: "/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/payments", label: "Pay", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: User },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile && ["admin", "staff"].includes(profile.role)) {
        setIsAdmin(true)
      }
    }
    checkRole()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border z-50">
        <div className="flex items-center justify-around py-2">
          {portalLinks.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1 text-xs",
                  isActive ? "text-brand-orange" : "text-text-secondary"
                )}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            )
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-1 text-xs",
                pathname.startsWith("/admin")
                  ? "text-brand-orange"
                  : "text-text-secondary"
              )}
            >
              <Shield className="h-5 w-5" />
              Admin
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}

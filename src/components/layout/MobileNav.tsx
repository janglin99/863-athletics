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
  UserCircle,
  Shield,
  FileText,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const portalLinks = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/book", label: "Book", icon: CalendarPlus },
  { href: "/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/payments", label: "Pay", icon: CreditCard },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isTrainer, setIsTrainer] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, first_name, last_name, email")
        .eq("id", user.id)
        .single()

      if (!profile) return

      if (["admin", "staff"].includes(profile.role)) setIsAdmin(true)
      if (profile.role === "trainer") setIsTrainer(true)

      const fullName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" ")
        .trim()
      setUserName(fullName || null)
      setUserEmail(profile.email ?? user.email ?? null)
    }
    loadProfile()
  }, [])

  const handleLogout = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push("/login")
  }

  const closeMenu = () => setMenuOpen(false)

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
          <button
            onClick={() => setMenuOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-1 text-xs",
              menuOpen ? "text-brand-orange" : "text-text-secondary"
            )}
            aria-label="Open account menu"
          >
            <UserCircle className="h-5 w-5" />
            Account
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="bg-bg-secondary border-l-border w-3/4 max-w-sm"
        >
          <SheetHeader>
            <SheetTitle className="font-display uppercase tracking-wide text-text-primary">
              Account
            </SheetTitle>
            {(userName || userEmail) && (
              <div className="pt-1">
                {userName && (
                  <p className="text-sm text-text-primary font-medium">
                    {userName}
                  </p>
                )}
                {userEmail && (
                  <p className="text-xs text-text-secondary">{userEmail}</p>
                )}
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 flex flex-col gap-1 px-4">
            <Link
              href="/profile"
              onClick={closeMenu}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <User className="h-5 w-5" />
              Profile
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Shield className="h-5 w-5" />
                Admin Portal
              </Link>
            )}
            {isTrainer && (
              <Link
                href="/invoices"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <FileText className="h-5 w-5" />
                Invoices
              </Link>
            )}
          </div>

          <div className="border-t border-border p-4">
            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-text-secondary hover:text-error hover:bg-bg-hover transition-colors w-full text-left disabled:opacity-50"
            >
              <LogOut className="h-5 w-5" />
              {signingOut ? "Logging out…" : "Log Out"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

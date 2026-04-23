"use client"

import { usePathname } from "next/navigation"
import { useCartStore } from "@/store/cartStore"
import { formatCents } from "@/lib/utils/format"
import { CartDrawer } from "./CartDrawer"

export function FloatingCartButton() {
  const { getItemCount, getTotalCents } = useCartStore()
  const pathname = usePathname()
  const count = getItemCount()

  // Hide on checkout and confirmation pages
  if (count === 0) return null
  if (pathname.startsWith("/book/checkout") || pathname.startsWith("/book/confirmation")) return null

  return (
    <div className="lg:hidden fixed bottom-16 left-4 right-4 z-40">
      <div className="bg-brand-orange rounded-lg shadow-lg shadow-brand-orange/25 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-white text-brand-orange text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
            {count}
          </span>
          <span className="text-white text-sm font-semibold">
            {formatCents(getTotalCents())}
          </span>
        </div>
        <CartDrawer />
      </div>
    </div>
  )
}

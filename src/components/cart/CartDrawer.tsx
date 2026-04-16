"use client"

import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cartStore"
import { formatCents, formatTime, formatDate } from "@/lib/utils/format"
import { ShoppingCart, Trash2, X, Repeat } from "lucide-react"

export function CartDrawer() {
  const { items, removeItem, getTotalCents, getItemCount } = useCartStore()
  const router = useRouter()
  const count = getItemCount()

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="relative border-border text-text-primary"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Cart
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {count}
              </span>
            )}
          </Button>
        }
      />
      <SheetContent className="bg-bg-secondary border-l-border w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display uppercase tracking-wide text-text-primary">
            Your Cart ({count})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-text-secondary">Your cart is empty</p>
            <p className="text-sm text-text-muted mt-1">
              Select time slots to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-bg-elevated rounded-lg p-4 border border-border"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-text-primary text-sm flex items-center gap-2">
                        {item.rateName}
                        {item.isRecurring && (
                          <span className="inline-flex items-center gap-1 text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded">
                            <Repeat className="h-3 w-3" />
                            {item.slots.length} sessions
                          </span>
                        )}
                      </h4>
                      <div className="mt-2 space-y-1">
                        {item.isRecurring ? (
                          <>
                            <p className="text-xs text-text-secondary">
                              {item.recurringConfig?.frequency} ·{" "}
                              {item.slots.length} sessions
                            </p>
                            <p className="text-xs text-text-muted font-mono">
                              {formatDate(item.slots[0].start)} —{" "}
                              {formatDate(item.slots[item.slots.length - 1].start)}
                            </p>
                          </>
                        ) : (
                          item.slots.map((slot, i) => (
                            <p
                              key={i}
                              className="text-xs text-text-secondary font-mono"
                            >
                              {formatDate(slot.start)} ·{" "}
                              {formatTime(slot.start)} - {formatTime(slot.end)}
                            </p>
                          ))
                        )}
                      </div>
                      {item.participantCount > 1 && (
                        <p className="text-xs text-text-muted mt-1">
                          {item.participantCount} participants
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-display font-bold text-brand-orange">
                        {formatCents(
                          item.pricePerUnit === "hour"
                            ? item.priceCents * item.slots.length
                            : item.priceCents
                        )}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-text-muted hover:text-error transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Total</span>
                <span className="text-2xl font-display font-bold text-brand-orange">
                  {formatCents(getTotalCents())}
                </span>
              </div>
              <Button
                onClick={() => router.push("/book/checkout")}
                className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-6"
              >
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

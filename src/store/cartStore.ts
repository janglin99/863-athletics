"use client"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartSlot {
  start: string
  end: string
}

export interface CartItem {
  id: string
  rateId: string
  rateName: string
  rateType: string
  priceCents: number
  pricePerUnit: string
  slots: CartSlot[]
  trainerId?: string
  trainerName?: string
  participantCount: number
  notes?: string
  isRecurring: boolean
  recurringConfig?: {
    frequency: "weekly" | "biweekly"
    daysOfWeek: number[]
    endDate: string
  }
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "id">) => void
  removeItem: (id: string) => void
  updateItem: (id: string, updates: Partial<CartItem>) => void
  clearCart: () => void
  getTotalCents: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => ({
          items: [...state.items, { ...item, id: crypto.randomUUID() }],
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      updateItem: (id, updates) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),

      clearCart: () => set({ items: [] }),

      getTotalCents: () => {
        const { items } = get()
        return items.reduce((total, item) => {
          const hours = item.slots.length
          if (item.pricePerUnit === "hour") {
            return total + item.priceCents * hours
          } else if (item.pricePerUnit === "person") {
            return total + item.priceCents * item.participantCount * hours
          }
          return total + item.priceCents
        }, 0)
      },

      getItemCount: () => get().items.length,
    }),
    { name: "863-cart" }
  )
)

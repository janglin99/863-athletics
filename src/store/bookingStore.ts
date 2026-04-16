"use client"
import { create } from "zustand"
import type { Rate } from "@/types"

interface BookingFlowState {
  step: number
  selectedRate: Rate | null
  selectedDate: Date | null
  selectedSlots: { start: string; end: string }[]
  participantCount: number
  trainerId: string | null
  notes: string
  paymentMethod: string | null
  waiverConfirmed: boolean
  setStep: (step: number) => void
  setSelectedRate: (rate: Rate | null) => void
  setSelectedDate: (date: Date | null) => void
  toggleSlot: (slot: { start: string; end: string }) => void
  clearSlots: () => void
  setParticipantCount: (count: number) => void
  setTrainerId: (id: string | null) => void
  setNotes: (notes: string) => void
  setPaymentMethod: (method: string | null) => void
  setWaiverConfirmed: (confirmed: boolean) => void
  reset: () => void
}

const initialState = {
  step: 1,
  selectedRate: null,
  selectedDate: null,
  selectedSlots: [],
  participantCount: 1,
  trainerId: null,
  notes: "",
  paymentMethod: null,
  waiverConfirmed: false,
}

export const useBookingStore = create<BookingFlowState>()((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),
  setSelectedRate: (rate) => set({ selectedRate: rate, selectedSlots: [] }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedSlots: [] }),

  toggleSlot: (slot) =>
    set((state) => {
      const exists = state.selectedSlots.find((s) => s.start === slot.start)
      if (exists) {
        return {
          selectedSlots: state.selectedSlots.filter(
            (s) => s.start !== slot.start
          ),
        }
      }
      const maxSlots = state.selectedRate?.max_hours || 10
      if (state.selectedSlots.length >= maxSlots) return state
      return { selectedSlots: [...state.selectedSlots, slot] }
    }),

  clearSlots: () => set({ selectedSlots: [] }),
  setParticipantCount: (count) => set({ participantCount: count }),
  setTrainerId: (id) => set({ trainerId: id }),
  setNotes: (notes) => set({ notes }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setWaiverConfirmed: (confirmed) => set({ waiverConfirmed: confirmed }),
  reset: () => set(initialState),
}))

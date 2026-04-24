"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"

interface HoldCountdownProps {
  expiresAt: string | null
  onExpired: () => void
}

export function HoldCountdown({ expiresAt, onExpired }: HoldCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null)
      return
    }

    function tick() {
      const diff = new Date(expiresAt!).getTime() - Date.now()
      if (diff <= 0) {
        setRemaining(0)
        onExpired()
      } else {
        setRemaining(Math.ceil(diff / 1000))
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, onExpired])

  if (remaining === null || remaining <= 0) return null

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const isUrgent = remaining < 60

  return (
    <div
      className={`flex items-center gap-2 text-sm font-mono px-3 py-1.5 rounded-md border ${
        isUrgent
          ? "text-warning border-warning/30 bg-warning/10"
          : "text-text-secondary border-border bg-bg-secondary"
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>
        Slots held for {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  )
}

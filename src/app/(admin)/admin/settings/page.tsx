"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

export default function AdminSettingsPage() {
  const [holdMinutes, setHoldMinutes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      const res = await fetch("/api/admin/settings")
      const data = await res.json()
      if (data.settings) {
        const hold = data.settings.find(
          (s: { key: string }) => s.key === "slot_hold_minutes"
        )
        if (hold) setHoldMinutes(hold.value)
      }
      setLoading(false)
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    const minutes = parseInt(holdMinutes, 10)
    if (isNaN(minutes) || minutes < 1 || minutes > 60) {
      toast.error("Hold duration must be between 1 and 60 minutes")
      return
    }

    setSaving(true)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "slot_hold_minutes", value: String(minutes) }),
    })

    if (res.ok) {
      toast.success("Settings saved")
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to save settings")
    }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure system-wide settings"
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="max-w-lg space-y-8">
          <div className="bg-bg-secondary rounded-lg border border-border p-6 space-y-4">
            <h3 className="font-display font-bold uppercase tracking-wide">
              Slot Hold Duration
            </h3>
            <p className="text-sm text-text-secondary">
              How long time slots are temporarily reserved when a customer adds
              them to their cart. If they don&apos;t complete checkout within this
              time, the slots become available again.
            </p>
            <div className="flex items-end gap-3">
              <div className="space-y-2 flex-1">
                <Label htmlFor="holdMinutes">Duration (minutes)</Label>
                <Input
                  id="holdMinutes"
                  type="number"
                  min={1}
                  max={60}
                  value={holdMinutes}
                  onChange={(e) => setHoldMinutes(e.target.value)}
                  className="bg-bg-elevated border-border"
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

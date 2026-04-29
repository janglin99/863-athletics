"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Loader2, Save, LogOut } from "lucide-react"
import type { Profile } from "@/types"

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [originalEmail, setOriginalEmail] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleLogout = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      setProfile(data)
      setOriginalEmail(data?.email ?? "")
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        emergency_name: profile.emergency_name,
        emergency_phone: profile.emergency_phone,
        notification_email: profile.notification_email,
        notification_sms: profile.notification_sms,
        notification_reminders: profile.notification_reminders,
      })
      .eq("id", profile.id)

    if (error) {
      toast.error("Failed to save profile")
      setSaving(false)
      return
    }

    const emailChanged =
      profile.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase()

    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: profile.email.trim(),
      })
      if (emailError) {
        toast.error(`Profile saved, but email change failed: ${emailError.message}`)
        setProfile({ ...profile, email: originalEmail })
        setSaving(false)
        return
      }
      toast.success(
        `Confirmation sent to ${profile.email.trim()}. Click the link in that email to finish the change.`
      )
    } else {
      toast.success("Profile updated!")
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48 bg-bg-elevated" />
        <Skeleton className="h-64 bg-bg-elevated rounded-lg" />
      </div>
    )
  }

  if (!profile) return null

  const update = (field: keyof Profile, value: unknown) =>
    setProfile({ ...profile, [field]: value } as Profile)

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" description="Manage your account settings" />

      <div className="space-y-6">
        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={profile.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                  className="bg-bg-elevated border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={profile.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                  className="bg-bg-elevated border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => update("email", e.target.value)}
                className="bg-bg-elevated border-border"
              />
              <p className="text-xs text-text-secondary">
                Changing your email sends a confirmation link to the new address. The change takes effect after you click that link.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={profile.phone || ""}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="(863) 555-1234"
                className="bg-bg-elevated border-border"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={profile.emergency_name || ""}
                onChange={(e) => update("emergency_name", e.target.value)}
                className="bg-bg-elevated border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={profile.emergency_phone || ""}
                onChange={(e) => update("emergency_phone", e.target.value)}
                className="bg-bg-elevated border-border"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-text-secondary">
                  Booking confirmations and updates
                </p>
              </div>
              <Switch
                checked={profile.notification_email}
                onCheckedChange={(c) => update("notification_email", c)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">SMS Notifications</p>
                <p className="text-sm text-text-secondary">
                  Access codes and reminders via text
                </p>
              </div>
              <Switch
                checked={profile.notification_sms}
                onCheckedChange={(c) => update("notification_sms", c)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Session Reminders</p>
                <p className="text-sm text-text-secondary">
                  24h and 1h before your session
                </p>
              </div>
              <Switch
                checked={profile.notification_reminders}
                onCheckedChange={(c) => update("notification_reminders", c)}
              />
            </div>
          </CardContent>
        </Card>

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
          Save Changes
        </Button>

        <Card className="bg-bg-secondary border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleLogout}
              disabled={signingOut}
              variant="outline"
              className="w-full border-border text-text-secondary hover:text-error hover:border-error"
            >
              {signingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

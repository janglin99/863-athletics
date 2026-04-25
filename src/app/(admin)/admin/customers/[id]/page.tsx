"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge"
import { formatCents, formatDateTime, formatPhone } from "@/lib/utils/format"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  UserCheck,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Clock,
  Ticket,
} from "lucide-react"
import type { Profile, Booking, UserCredit } from "@/types"

export default function AdminCustomerDetailPage() {
  const params = useParams()
  const [customer, setCustomer] = useState<Profile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [newRole, setNewRole] = useState("")
  const [newTrainerType, setNewTrainerType] = useState("")
  const [saving, setSaving] = useState(false)

  // Credits state
  const [credits, setCredits] = useState<UserCredit[]>([])
  const [addCreditOpen, setAddCreditOpen] = useState(false)
  const [creditType, setCreditType] = useState<"dollar" | "hours" | "sessions">("dollar")
  const [creditAmount, setCreditAmount] = useState("")
  const [creditDescription, setCreditDescription] = useState("")
  const [creditExpiry, setCreditExpiry] = useState("")
  const [savingCredit, setSavingCredit] = useState(false)

  const [adjustCreditOpen, setAdjustCreditOpen] = useState(false)
  const [adjustCreditId, setAdjustCreditId] = useState<string | null>(null)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustNotes, setAdjustNotes] = useState("")

  const [deleteCreditOpen, setDeleteCreditOpen] = useState(false)
  const [deleteCreditId, setDeleteCreditId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: profile }, { data: customerBookings }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", params.id)
            .single(),
          supabase
            .from("bookings")
            .select("*, rate:rates(name), slots:booking_slots(*)")
            .eq("customer_id", params.id as string)
            .order("created_at", { ascending: false })
            .limit(20),
        ])

      setCustomer(profile)
      if (profile) {
        setNewRole(profile.role)
        setNewTrainerType(profile.trainer_type || "external")
      }
      setBookings(customerBookings || [])

      // Load credits
      const creditsRes = await fetch(`/api/credits?customerId=${params.id}`)
      const creditsData = await creditsRes.json()
      setCredits(creditsData.credits || [])

      setLoading(false)
    }
    load()
  }, [params.id])

  const loadCredits = async () => {
    const res = await fetch(`/api/credits?customerId=${params.id}`)
    const data = await res.json()
    setCredits(data.credits || [])
  }

  const handleAddCredit = async () => {
    if (!creditAmount || Number(creditAmount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    setSavingCredit(true)
    const res = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: params.id,
        creditType: creditType,
        amount: Number(creditAmount),
        description: creditDescription || null,
        expiresAt: creditExpiry || null,
      }),
    })
    if (res.ok) {
      toast.success("Credit added")
      setAddCreditOpen(false)
      setCreditAmount("")
      setCreditDescription("")
      setCreditExpiry("")
      setCreditType("dollar")
      await loadCredits()
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to add credit")
    }
    setSavingCredit(false)
  }

  const handleAdjustCredit = async () => {
    if (!adjustCreditId || adjustAmount === "") return
    setSavingCredit(true)
    const res = await fetch("/api/credits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditId: adjustCreditId,
        newAmount: Number(adjustAmount),
        notes: adjustNotes || null,
      }),
    })
    if (res.ok) {
      toast.success("Credit adjusted")
      setAdjustCreditOpen(false)
      setAdjustCreditId(null)
      setAdjustAmount("")
      setAdjustNotes("")
      await loadCredits()
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to adjust credit")
    }
    setSavingCredit(false)
  }

  const handleDeleteCredit = async () => {
    if (!deleteCreditId) return
    const res = await fetch("/api/credits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditId: deleteCreditId }),
    })
    if (res.ok) {
      toast.success("Credit removed")
      setDeleteCreditOpen(false)
      setDeleteCreditId(null)
      await loadCredits()
    } else {
      const data = await res.json()
      toast.error(data.error || "Failed to remove credit")
    }
  }

  const creditTypeLabel = (type: string) => {
    switch (type) {
      case "dollar": return "Dollar"
      case "hours": return "Hours"
      case "sessions": return "Sessions"
      default: return type
    }
  }

  const creditTypeColor = (type: string) => {
    switch (type) {
      case "dollar": return "bg-success/10 text-success border-success/30"
      case "hours": return "bg-brand-steel/10 text-brand-steel border-brand-steel/30"
      case "sessions": return "bg-brand-orange/10 text-brand-orange border-brand-orange/30"
      default: return ""
    }
  }

  const creditTypeIcon = (type: string) => {
    switch (type) {
      case "dollar": return <DollarSign className="h-4 w-4" />
      case "hours": return <Clock className="h-4 w-4" />
      case "sessions": return <Ticket className="h-4 w-4" />
      default: return null
    }
  }

  const formatCreditAmount = (credit: UserCredit) => {
    if (credit.credit_type === "dollar") return `$${Number(credit.remaining_amount).toFixed(2)} / $${Number(credit.original_amount).toFixed(2)}`
    if (credit.credit_type === "hours") return `${Number(credit.remaining_amount)} / ${Number(credit.original_amount)} hours`
    return `${Number(credit.remaining_amount)} / ${Number(credit.original_amount)} sessions`
  }

  const handleRoleChange = async () => {
    if (!customer) return
    setSaving(true)

    const supabase = createClient()
    const updates: Record<string, unknown> = { role: newRole }

    if (newRole === "trainer") {
      updates.trainer_type = newTrainerType
    } else {
      updates.trainer_type = null
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", customer.id)

    if (error) {
      toast.error("Failed to update role")
    } else {
      toast.success(`Role updated to ${newRole}${newRole === "trainer" ? ` (${newTrainerType})` : ""}`)
      setCustomer({
        ...customer,
        role: newRole as Profile["role"],
        trainer_type: newRole === "trainer" ? (newTrainerType as Profile["trainer_type"]) : null,
      })
      setRoleDialogOpen(false)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-bg-elevated" />
        <Skeleton className="h-48 bg-bg-elevated rounded-lg" />
      </div>
    )
  }

  if (!customer) return <p className="text-text-secondary">Customer not found.</p>

  const totalSpent = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((sum, b) => sum + b.total_cents, 0)

  const roleBadgeColor: Record<string, string> = {
    customer: "bg-text-secondary/10 text-text-secondary border-text-secondary/30",
    trainer: "bg-brand-steel/10 text-brand-steel border-brand-steel/30",
    staff: "bg-warning/10 text-warning border-warning/30",
    admin: "bg-brand-orange/10 text-brand-orange border-brand-orange/30",
  }

  return (
    <div className="max-w-3xl">
      <Link href="/admin/customers">
        <Button variant="ghost" size="sm" className="text-text-secondary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Customers
        </Button>
      </Link>

      <PageHeader
        title={`${customer.first_name} ${customer.last_name}`}
        description={`Member since ${formatDateTime(customer.created_at)}`}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-display font-bold">{bookings.length}</p>
            <p className="text-xs text-text-secondary">Total Bookings</p>
          </CardContent>
        </Card>
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-display font-bold text-brand-orange">
              {formatCents(totalSpent)}
            </p>
            <p className="text-xs text-text-secondary">Total Spent</p>
          </CardContent>
        </Card>
        <Card className="bg-bg-secondary border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-display font-bold">
              {customer.waiver_signed ? "Yes" : "No"}
            </p>
            <p className="text-xs text-text-secondary">Waiver Signed</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-bg-secondary border-border mb-6">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-sm">
            Contact Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-text-muted" />
            <span>{customer.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-text-muted" />
            <span>
              {customer.phone ? formatPhone(customer.phone) : "No phone"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-text-muted" />
              <Badge variant="outline" className={roleBadgeColor[customer.role] || ""}>
                {customer.role}
                {customer.role === "trainer" && customer.trainer_type && (
                  <span className="ml-1">({customer.trainer_type.replace("_", "-")})</span>
                )}
              </Badge>
            </div>
            <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
              <DialogTrigger>
                <Button variant="outline" size="sm" className="border-border text-text-secondary text-xs">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Change Role
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-bg-secondary border-border">
                <DialogHeader>
                  <DialogTitle className="font-display uppercase tracking-wide">
                    Change User Role
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newRole} onValueChange={(v) => v && setNewRole(v)}>
                      <SelectTrigger className="bg-bg-elevated border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newRole === "trainer" && (
                    <div className="space-y-2">
                      <Label>Trainer Type</Label>
                      <Select value={newTrainerType} onValueChange={(v) => v && setNewTrainerType(v)}>
                        <SelectTrigger className="bg-bg-elevated border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_house">In-House (Net 30, no upfront payment)</SelectItem>
                          <SelectItem value="external">External (pays at booking)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-text-muted">
                        {newTrainerType === "in_house"
                          ? "In-house trainers book without payment. Sessions are billed monthly."
                          : "External trainers pay at the time of booking like regular customers."}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleRoleChange}
                    disabled={saving}
                    className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Role
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Credits Section */}
      <Card className="bg-bg-secondary border-border mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display uppercase tracking-wide text-sm">
            Credits
          </CardTitle>
          <Dialog open={addCreditOpen} onOpenChange={setAddCreditOpen}>
            <DialogTrigger>
              <Button size="sm" className="bg-brand-orange hover:bg-brand-orange-dark text-white text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add Credit
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-bg-secondary border-border">
              <DialogHeader>
                <DialogTitle className="font-display uppercase tracking-wide">
                  Add Credit
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Credit Type</Label>
                  <Select value={creditType} onValueChange={(v) => setCreditType(v as "dollar" | "hours" | "sessions")}>
                    <SelectTrigger className="bg-bg-elevated border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dollar">Dollar Amount</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="sessions">Sessions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Amount{" "}
                    <span className="text-text-muted">
                      ({creditType === "dollar" ? "$" : creditType === "hours" ? "hours" : "sessions"})
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step={creditType === "dollar" ? "0.01" : "1"}
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder={creditType === "dollar" ? "50.00" : "10"}
                    className="bg-bg-elevated border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={creditDescription}
                    onChange={(e) => setCreditDescription(e.target.value)}
                    placeholder="e.g. Welcome bonus, Compensation for issue"
                    className="bg-bg-elevated border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires At <span className="text-text-muted">(optional)</span></Label>
                  <Input
                    type="date"
                    value={creditExpiry}
                    onChange={(e) => setCreditExpiry(e.target.value)}
                    className="bg-bg-elevated border-border"
                  />
                </div>
                <Button
                  onClick={handleAddCredit}
                  disabled={savingCredit}
                  className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
                >
                  {savingCredit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Credit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {credits.length === 0 ? (
            <p className="text-sm text-text-muted">No active credits</p>
          ) : (
            <div className="space-y-3">
              {credits.map((credit) => (
                <div
                  key={credit.id}
                  className="bg-bg-elevated rounded-lg border border-border p-4 flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={creditTypeColor(credit.credit_type)}>
                        {creditTypeIcon(credit.credit_type)}
                        <span className="ml-1">{creditTypeLabel(credit.credit_type)}</span>
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatCreditAmount(credit)}
                    </p>
                    {credit.description && (
                      <p className="text-xs text-text-secondary">{credit.description}</p>
                    )}
                    <p className="text-xs text-text-muted">
                      Granted {formatDateTime(credit.created_at)}
                      {credit.expires_at && ` · Expires ${formatDateTime(credit.expires_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-text-secondary h-8 w-8 p-0"
                      onClick={() => {
                        setAdjustCreditId(credit.id)
                        setAdjustAmount(String(credit.remaining_amount))
                        setAdjustNotes("")
                        setAdjustCreditOpen(true)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-error h-8 w-8 p-0"
                      onClick={() => {
                        setDeleteCreditId(credit.id)
                        setDeleteCreditOpen(true)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Credit Dialog */}
      <Dialog open={adjustCreditOpen} onOpenChange={setAdjustCreditOpen}>
        <DialogContent className="bg-bg-secondary border-border">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide">
              Adjust Credit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>New Remaining Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="bg-bg-elevated border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-text-muted">(optional)</span></Label>
              <Input
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Reason for adjustment"
                className="bg-bg-elevated border-border"
              />
            </div>
            <Button
              onClick={handleAdjustCredit}
              disabled={savingCredit}
              className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold"
            >
              {savingCredit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Credit Confirm */}
      <ConfirmDialog
        open={deleteCreditOpen}
        onOpenChange={setDeleteCreditOpen}
        title="Remove Credit"
        description="Are you sure you want to remove this credit? This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={handleDeleteCredit}
        variant="destructive"
      />

      <h3 className="font-display font-bold uppercase tracking-wide mb-3">
        Booking History
      </h3>
      <div className="space-y-2">
        {bookings.map((booking) => {
          const firstSlot = booking.slots?.[0]
          return (
            <Link key={booking.id} href={`/admin/bookings/${booking.id}`}>
              <Card className="bg-bg-secondary border-border hover:border-brand-orange/50 transition-colors cursor-pointer">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-muted">
                          {booking.booking_number}
                        </span>
                        <BookingStatusBadge status={booking.status} />
                      </div>
                      <p className="text-sm text-text-secondary">
                        {booking.rate?.name}
                        {firstSlot && ` · ${formatDateTime(firstSlot.start_time)}`}
                      </p>
                    </div>
                    <span className="font-display font-bold">
                      {formatCents(booking.total_cents)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

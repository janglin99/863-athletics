"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCents } from "@/lib/utils/format"
import { toast } from "sonner"
import {
  UserCheck,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import type { Profile, TrainerInvoice } from "@/types"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface TrainerWithStats extends Profile {
  sessionsThisMonth: number
}

export default function AdminTrainersPage() {
  const [trainers, setTrainers] = useState<TrainerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [editTrainer, setEditTrainer] = useState<Profile | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editType, setEditType] = useState<string>("in_house")
  const [editCommissionRate, setEditCommissionRate] = useState<number>(10)
  const [editCommissionType, setEditCommissionType] = useState<string>("percentage")
  const [editFacilityRate, setEditFacilityRate] = useState<number>(2000)

  // Monthly billing
  const now = new Date()
  const [billingMonth, setBillingMonth] = useState(now.getMonth() + 1)
  const [billingYear, setBillingYear] = useState(now.getFullYear())
  const [invoices, setInvoices] = useState<TrainerInvoice[]>([])
  const [billingData, setBillingData] = useState<
    Array<{
      trainer: Profile
      totalSessions: number
      totalHours: number
      amountCents: number
      invoice: TrainerInvoice | null
    }>
  >([])
  const [billingLoading, setBillingLoading] = useState(false)

  const supabase = createClient()

  const loadTrainers = useCallback(async () => {
    const { data: trainerProfiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "trainer")
      .order("last_name")

    if (!trainerProfiles) {
      setTrainers([])
      setLoading(false)
      return
    }

    // Get session counts for current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const withStats = await Promise.all(
      trainerProfiles.map(async (t) => {
        const { count } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", t.id)
          .eq("payment_method", "trainer_account")
          .eq("status", "confirmed")
          .gte("created_at", startOfMonth)
          .lte("created_at", endOfMonth)

        return { ...t, sessionsThisMonth: count || 0 }
      })
    )

    setTrainers(withStats)
    setLoading(false)
  }, [])

  const loadBillingData = useCallback(async () => {
    setBillingLoading(true)

    // Get in-house trainers
    const { data: inHouseTrainers } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "trainer")
      .eq("trainer_type", "in_house")

    if (!inHouseTrainers || inHouseTrainers.length === 0) {
      setBillingData([])
      setBillingLoading(false)
      return
    }

    // Get existing invoices for this month
    const { data: existingInvoices } = await supabase
      .from("trainer_invoices")
      .select("*")
      .eq("month", billingMonth)
      .eq("year", billingYear)

    setInvoices(existingInvoices || [])

    // Get booking data for each trainer
    const startOfMonth = new Date(billingYear, billingMonth - 1, 1).toISOString()
    const endOfMonth = new Date(billingYear, billingMonth, 0, 23, 59, 59).toISOString()

    const data = await Promise.all(
      inHouseTrainers.map(async (trainer) => {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("*, slots:booking_slots(*)")
          .eq("customer_id", trainer.id)
          .eq("payment_method", "trainer_account")
          .eq("status", "confirmed")
          .gte("created_at", startOfMonth)
          .lte("created_at", endOfMonth)

        const totalSessions = bookings?.length || 0
        let totalHours = 0
        bookings?.forEach((b) => {
          b.slots?.forEach((slot: { start_time: string; end_time: string }) => {
            const start = new Date(slot.start_time)
            const end = new Date(slot.end_time)
            totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60)
          })
        })

        // Calculate amount
        let amountCents = 0
        if (trainer.commission_type === "flat_per_session") {
          amountCents = (trainer.commission_rate || 0) * 100 * totalSessions
        } else if (trainer.commission_type === "flat_monthly") {
          amountCents = (trainer.commission_rate || 0) * 100
        }
        // percentage type shows "manual" — amount stays 0

        const invoice =
          existingInvoices?.find((inv) => inv.trainer_id === trainer.id) || null

        return { trainer, totalSessions, totalHours, amountCents, invoice }
      })
    )

    setBillingData(data)
    setBillingLoading(false)
  }, [billingMonth, billingYear])

  useEffect(() => {
    loadTrainers()
  }, [loadTrainers])

  useEffect(() => {
    loadBillingData()
  }, [loadBillingData])

  const openEdit = (trainer: Profile) => {
    setEditTrainer(trainer)
    setEditType(trainer.trainer_type || "in_house")
    setEditCommissionRate(trainer.commission_rate || 10)
    setEditCommissionType(trainer.commission_type || "percentage")
    setEditFacilityRate(trainer.facility_rate_cents || 2000)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editTrainer) return
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({
        trainer_type: editType,
        commission_rate: editCommissionRate,
        commission_type: editCommissionType,
        facility_rate_cents: editFacilityRate,
      })
      .eq("id", editTrainer.id)

    if (error) {
      toast.error("Failed to update trainer")
    } else {
      toast.success("Trainer updated")
      setEditOpen(false)
      loadTrainers()
    }
    setSaving(false)
  }

  const upsertInvoice = async (
    trainerId: string,
    status: "invoiced" | "paid",
    totalSessions: number,
    totalHours: number,
    amountCents: number
  ) => {
    const payload: Record<string, unknown> = {
      trainer_id: trainerId,
      month: billingMonth,
      year: billingYear,
      total_sessions: totalSessions,
      total_hours: totalHours,
      total_amount_cents: amountCents,
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === "paid") {
      payload.paid_at = new Date().toISOString()
    }

    const existing = invoices.find((inv) => inv.trainer_id === trainerId)

    if (existing) {
      const { error } = await supabase
        .from("trainer_invoices")
        .update(payload)
        .eq("id", existing.id)
      if (error) {
        toast.error("Failed to update invoice")
        return
      }
    } else {
      const { error } = await supabase
        .from("trainer_invoices")
        .insert(payload)
      if (error) {
        toast.error("Failed to create invoice")
        return
      }
    }

    toast.success(`Marked as ${status}`)
    loadBillingData()
  }

  const prevMonth = () => {
    if (billingMonth === 1) {
      setBillingMonth(12)
      setBillingYear(billingYear - 1)
    } else {
      setBillingMonth(billingMonth - 1)
    }
  }

  const nextMonth = () => {
    if (billingMonth === 12) {
      setBillingMonth(1)
      setBillingYear(billingYear + 1)
    } else {
      setBillingMonth(billingMonth + 1)
    }
  }

  return (
    <div>
      <PageHeader
        title="Trainers"
        description="Manage trainers and monthly billing"
      />

      {/* Trainer List */}
      <h2 className="font-display font-bold uppercase tracking-wide text-lg mb-4">
        All Trainers
      </h2>

      {loading ? (
        <div className="space-y-3 mb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
          ))}
        </div>
      ) : trainers.length === 0 ? (
        <Card className="bg-bg-secondary border-border mb-10">
          <CardContent className="py-8 text-center">
            <UserCheck className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary text-sm">
              No trainers found. Assign the &quot;trainer&quot; role to a user to
              see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 mb-10">
          {trainers.map((trainer) => (
            <Card
              key={trainer.id}
              className="bg-bg-secondary border-border"
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-bg-elevated flex items-center justify-center text-sm font-bold text-text-secondary">
                      {trainer.first_name[0]}
                      {trainer.last_name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {trainer.first_name} {trainer.last_name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {trainer.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={
                        trainer.trainer_type === "in_house"
                          ? "border-green-500/50 text-green-400 text-xs"
                          : "border-blue-500/50 text-blue-400 text-xs"
                      }
                    >
                      {trainer.trainer_type === "in_house"
                        ? "In-House"
                        : "External"}
                    </Badge>
                    <span className="text-xs text-text-muted whitespace-nowrap">
                      {trainer.commission_type === "percentage"
                        ? `${trainer.commission_rate}%`
                        : trainer.commission_type === "flat_per_session"
                        ? `${formatCents((trainer.commission_rate || 0) * 100)}/session`
                        : trainer.commission_type === "flat_monthly"
                        ? `${formatCents((trainer.commission_rate || 0) * 100)}/mo`
                        : `Rate: ${formatCents(trainer.facility_rate_cents || 0)}`}
                    </span>
                    <span className="text-xs text-text-muted">
                      {trainer.sessionsThisMonth} sessions
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(trainer)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Monthly Billing */}
      <div className="border-t border-border pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            Monthly Billing
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[140px] text-center">
              {MONTHS[billingMonth - 1]} {billingYear}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {billingLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-bg-elevated rounded-lg" />
            ))}
          </div>
        ) : billingData.length === 0 ? (
          <Card className="bg-bg-secondary border-border">
            <CardContent className="py-8 text-center">
              <p className="text-text-secondary text-sm">
                No in-house trainers with billing data for this period.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="pb-3 font-medium">Trainer</th>
                  <th className="pb-3 font-medium text-center">Sessions</th>
                  <th className="pb-3 font-medium text-center">Hours</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-center">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billingData.map((row) => {
                  const status = row.invoice?.status || "pending"
                  return (
                    <tr
                      key={row.trainer.id}
                      className="border-b border-border/50"
                    >
                      <td className="py-3">
                        <p className="font-semibold">
                          {row.trainer.first_name} {row.trainer.last_name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {row.trainer.email}
                        </p>
                      </td>
                      <td className="py-3 text-center">{row.totalSessions}</td>
                      <td className="py-3 text-center">
                        {row.totalHours.toFixed(1)}
                      </td>
                      <td className="py-3 text-right">
                        {row.trainer.commission_type === "percentage" ? (
                          <span className="text-text-muted italic">Manual</span>
                        ) : (
                          formatCents(row.amountCents)
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            status === "paid"
                              ? "border-green-500/50 text-green-400"
                              : status === "invoiced"
                              ? "border-yellow-500/50 text-yellow-400"
                              : "border-border text-text-muted"
                          }
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {status !== "invoiced" && status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() =>
                                upsertInvoice(
                                  row.trainer.id,
                                  "invoiced",
                                  row.totalSessions,
                                  row.totalHours,
                                  row.amountCents
                                )
                              }
                            >
                              Mark Invoiced
                            </Button>
                          )}
                          {status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-green-400"
                              onClick={() =>
                                upsertInvoice(
                                  row.trainer.id,
                                  "paid",
                                  row.totalSessions,
                                  row.totalHours,
                                  row.amountCents
                                )
                              }
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Trainer Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-bg-elevated border-border">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide">
              Edit Trainer
            </DialogTitle>
          </DialogHeader>

          {editTrainer && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                {editTrainer.first_name} {editTrainer.last_name} ({editTrainer.email})
              </p>

              <div className="space-y-2">
                <Label>Trainer Type</Label>
                <Select value={editType} onValueChange={(v) => v && setEditType(v)}>
                  <SelectTrigger className="bg-bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_house">In-House</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Commission Type</Label>
                <Select
                  value={editCommissionType}
                  onValueChange={(v) => v && setEditCommissionType(v)}
                >
                  <SelectTrigger className="bg-bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat_per_session">
                      Flat per Session
                    </SelectItem>
                    <SelectItem value="flat_monthly">Flat Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {editCommissionType === "percentage"
                    ? "Commission Rate (%)"
                    : editCommissionType === "flat_per_session"
                    ? "Rate per Session ($)"
                    : "Monthly Rate ($)"}
                </Label>
                <Input
                  type="number"
                  value={editCommissionRate}
                  onChange={(e) =>
                    setEditCommissionRate(Number(e.target.value))
                  }
                  className="bg-bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label>Facility Rate (cents)</Label>
                <Input
                  type="number"
                  value={editFacilityRate}
                  onChange={(e) =>
                    setEditFacilityRate(Number(e.target.value))
                  }
                  className="bg-bg-secondary border-border"
                />
                <p className="text-xs text-text-muted">
                  {formatCents(editFacilityRate)} per session
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-brand-orange hover:bg-brand-orange-dark text-white"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

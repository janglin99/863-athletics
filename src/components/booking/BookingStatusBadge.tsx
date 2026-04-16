import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BookingStatus, PaymentStatus } from "@/types"

const statusConfig: Record<
  BookingStatus,
  { label: string; className: string }
> = {
  pending_payment: {
    label: "Pending Payment",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-success/10 text-success border-success/30",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-info/10 text-info border-info/30",
  },
  completed: {
    label: "Completed",
    className: "bg-text-secondary/10 text-text-secondary border-text-secondary/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-error/10 text-error border-error/30",
  },
  no_show: {
    label: "No Show",
    className: "bg-error/10 text-error border-error/30",
  },
  refunded: {
    label: "Refunded",
    className: "bg-text-muted/10 text-text-muted border-text-muted/30",
  },
}

const paymentConfig: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  unpaid: {
    label: "Unpaid",
    className: "bg-error/10 text-error border-error/30",
  },
  pending_manual: {
    label: "Pending Confirmation",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  paid: {
    label: "Paid",
    className: "bg-success/10 text-success border-success/30",
  },
  partially_refunded: {
    label: "Partially Refunded",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  fully_refunded: {
    label: "Refunded",
    className: "bg-text-muted/10 text-text-muted border-text-muted/30",
  },
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = paymentConfig[status]
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  )
}

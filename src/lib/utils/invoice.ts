import { format } from "date-fns"
import type { CustomerInvoice } from "@/types"

export function formatInvoicePeriod(
  invoice: Pick<CustomerInvoice, "period_type" | "period_start" | "period_end">
): string {
  const start = new Date(invoice.period_start)
  const end = new Date(invoice.period_end)

  switch (invoice.period_type) {
    case "month":
      return format(start, "MMMM yyyy")
    case "week":
    case "custom":
      return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
    case "day":
      return format(start, "MMMM d, yyyy")
    case "session":
      return format(start, "MMMM d, yyyy 'at' h:mm a")
    default:
      return format(start, "MMMM d, yyyy")
  }
}

export const PERIOD_TYPE_LABELS: Record<CustomerInvoice["period_type"], string> = {
  session: "Session",
  day: "Day",
  week: "Week",
  month: "Month",
  custom: "Custom",
}

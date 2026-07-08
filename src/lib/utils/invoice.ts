import { formatEastern } from "@/lib/utils/timezone"
import type { CustomerInvoice } from "@/types"

export function formatInvoicePeriod(
  invoice: Pick<CustomerInvoice, "period_type" | "period_start" | "period_end">
): string {
  const start = invoice.period_start
  const end = invoice.period_end

  switch (invoice.period_type) {
    case "month":
      return formatEastern(start, "MMMM yyyy")
    case "week":
    case "custom":
      return `${formatEastern(start, "MMM d")} – ${formatEastern(end, "MMM d, yyyy")}`
    case "day":
      return formatEastern(start, "MMMM d, yyyy")
    case "session":
      return formatEastern(start, "MMMM d, yyyy 'at' h:mm a")
    default:
      return formatEastern(start, "MMMM d, yyyy")
  }
}

export const PERIOD_TYPE_LABELS: Record<CustomerInvoice["period_type"], string> = {
  session: "Session",
  day: "Day",
  week: "Week",
  month: "Month",
  custom: "Custom",
}

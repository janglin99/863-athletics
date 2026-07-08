import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { FACILITY } from "@/lib/constants/facility"
import { formatInvoicePeriod } from "@/lib/utils/invoice"
import type { CustomerInvoice, CustomerInvoiceItem, Profile } from "@/types"

const BRAND_ORANGE = "#FF4700"
const TEXT_PRIMARY = "#18181B"
const TEXT_SECONDARY = "#52525B"
const TEXT_MUTED = "#9CA3AF"
const BORDER = "#E4E4E7"
const BG_SUBTLE = "#FAFAFA"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: TEXT_PRIMARY,
  },
  letterheadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  billTo: {
    maxWidth: 260,
  },
  billToLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  customerName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  customerLine: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    marginBottom: 1,
  },
  brandBlock: {
    alignItems: "flex-end",
  },
  brandName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: BRAND_ORANGE,
    letterSpacing: 1,
    marginBottom: 3,
  },
  brandLine: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    marginBottom: 1,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: BG_SUBTLE,
    borderRadius: 4,
    padding: 14,
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: "column",
  },
  metaLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    letterSpacing: 0.5,
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: TEXT_PRIMARY,
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 7,
  },
  colDate: { width: "20%" },
  colDescription: { width: "42%" },
  colStatus: { width: "18%" },
  colAmount: { width: "20%", textAlign: "right" },
  headerText: {
    fontSize: 8,
    color: TEXT_MUTED,
    letterSpacing: 0.5,
    fontFamily: "Helvetica-Bold",
  },
  cellText: {
    fontSize: 9.5,
    color: TEXT_PRIMARY,
  },
  cellTextMuted: {
    fontSize: 8.5,
    color: TEXT_SECONDARY,
    textTransform: "capitalize",
  },
  emptyState: {
    fontSize: 9.5,
    color: TEXT_MUTED,
    paddingVertical: 16,
    textAlign: "center",
  },
  totalsBlock: {
    alignSelf: "flex-end",
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: {
    fontSize: 9.5,
    color: TEXT_SECONDARY,
  },
  totalsValue: {
    fontSize: 9.5,
    color: TEXT_PRIMARY,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: TEXT_PRIMARY,
    marginTop: 4,
    paddingTop: 8,
  },
  balanceLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  balanceValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND_ORANGE,
  },
  statusStamp: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  paymentsSection: {
    marginBottom: 20,
  },
  paymentsSectionLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
    letterSpacing: 0.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  paymentText: {
    fontSize: 8.5,
    color: TEXT_SECONDARY,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 12,
  },
  footerThanks: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  footerLine: {
    fontSize: 7.5,
    color: TEXT_MUTED,
  },
})

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  })
}

interface CustomerInvoiceDocumentProps {
  invoice: CustomerInvoice
  customer: Profile
}

export function CustomerInvoiceDocument({
  invoice,
  customer,
}: CustomerInvoiceDocumentProps) {
  const items = invoice.items ?? []
  const payments = invoice.payments ?? []
  const balanceDueCents = invoice.total_cents - invoice.paid_cents
  const isClosed = invoice.status === "closed"

  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Letterhead: customer info top-left, facility branding top-right */}
        <View style={styles.letterheadRow}>
          <View style={styles.billTo}>
            <Text style={styles.billToLabel}>BILL TO</Text>
            <Text style={styles.customerName}>
              {customer.first_name} {customer.last_name}
            </Text>
            <Text style={styles.customerLine}>{customer.email}</Text>
            {customer.phone && (
              <Text style={styles.customerLine}>{customer.phone}</Text>
            )}
          </View>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>{FACILITY.name.toUpperCase()}</Text>
            <Text style={styles.brandLine}>{FACILITY.tagline}</Text>
            <Text style={styles.brandLine}>{FACILITY.addressLine1}</Text>
            <Text style={styles.brandLine}>{FACILITY.addressLine2}</Text>
            <Text style={styles.brandLine}>{FACILITY.phone}</Text>
            <Text style={styles.brandLine}>{FACILITY.email}</Text>
          </View>
        </View>

        {/* Invoice metadata */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>INVOICE #</Text>
            <Text style={styles.metaValue}>{invoice.invoice_number}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>DATE GENERATED</Text>
            <Text style={styles.metaValue}>
              {formatDate(invoice.created_at)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>PERIOD</Text>
            <Text style={styles.metaValue}>
              {formatInvoicePeriod(invoice)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>STATUS</Text>
            <Text
              style={[
                styles.statusStamp,
                isClosed
                  ? { color: "#15803D", backgroundColor: "#DCFCE7" }
                  : { color: BRAND_ORANGE, backgroundColor: "#FFEDE3" },
              ]}
            >
              {isClosed ? "PAID IN FULL" : "BALANCE DUE"}
            </Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDate]}>DATE</Text>
            <Text style={[styles.headerText, styles.colDescription]}>
              DESCRIPTION
            </Text>
            <Text style={[styles.headerText, styles.colStatus]}>STATUS</Text>
            <Text style={[styles.headerText, styles.colAmount]}>AMOUNT</Text>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyState}>
              No sessions in this billing period.
            </Text>
          ) : (
            items.map((item: CustomerInvoiceItem) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cellText, styles.colDate]}>
                  {formatDate(item.session_date)}
                </Text>
                <Text style={[styles.cellText, styles.colDescription]}>
                  {item.description}
                </Text>
                <Text style={[styles.cellTextMuted, styles.colStatus]}>
                  {item.payment_status.replace(/_/g, " ")}
                </Text>
                <Text style={[styles.cellText, styles.colAmount]}>
                  {formatCents(item.amount_cents)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total</Text>
            <Text style={styles.totalsValue}>
              {formatCents(invoice.total_cents)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Amount Paid</Text>
            <Text style={styles.totalsValue}>
              {formatCents(invoice.paid_cents)}
            </Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance Due</Text>
            <Text style={styles.balanceValue}>
              {formatCents(balanceDueCents)}
            </Text>
          </View>
        </View>

        {payments.length > 0 && (
          <View style={styles.paymentsSection}>
            <Text style={styles.paymentsSectionLabel}>PAYMENTS RECEIVED</Text>
            {payments.map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <Text style={styles.paymentText}>
                  {formatDate(p.paid_at)} · {p.method.replace(/_/g, " ")}
                  {p.note ? ` · ${p.note}` : ""}
                </Text>
                <Text style={styles.paymentText}>
                  {formatCents(p.amount_cents)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerThanks}>
            Thank you for training with {FACILITY.name}.
          </Text>
          <Text style={styles.footerLine}>
            {FACILITY.name} · {FACILITY.addressLine1}, {FACILITY.addressLine2} ·{" "}
            {FACILITY.phone} · {FACILITY.website}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

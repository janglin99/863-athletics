import type { Metadata } from "next"
import Link from "next/link"
import { getStripeServer } from "@/lib/stripe/server"
import { formatCents } from "@/lib/utils/format"
import styles from "@/components/shop/shop.module.css"

export const metadata: Metadata = { title: "Order confirmed" }

export default async function ShopSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  let paid = false
  let total: number | null = null
  let email: string | null = null
  let pickupAddress: string | null = null
  if (session_id) {
    try {
      const session = await getStripeServer().checkout.sessions.retrieve(session_id)
      paid = session.payment_status === "paid"
      total = session.amount_total
      email = session.customer_details?.email ?? null
      pickupAddress =
        session.metadata?.fulfillment === "pickup"
          ? (session.metadata.pickup_address ?? null)
          : null
    } catch {
      // Fall through to the generic message below.
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.successCard}>
        <span className={styles.tick} aria-hidden>✓</span>
        <h1>{paid ? "Order confirmed" : "Thanks for your order"}</h1>
        <p>
          {paid && total !== null
            ? `We received your payment of ${formatCents(total)}.`
            : "Your payment is being processed."}
          {email && ` A confirmation email is on its way to ${email}.`}
        </p>
        {pickupAddress && (
          <div className={styles.pickupBox}>
            <span className={styles.label}>Pick up at</span>
            <address>{pickupAddress}</address>
          </div>
        )}
        <Link href="/shop" className={styles.linkBtn}>Back to shop</Link>
      </div>
    </div>
  )
}

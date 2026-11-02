import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ShirtPurchase } from "@/components/shop/ShirtPurchase"
import { SHIRT } from "@/lib/shop/products"
import { getShopConfig } from "@/lib/shop/config"
import { formatCents } from "@/lib/utils/format"
import styles from "@/components/shop/shop.module.css"

export async function generateMetadata(): Promise<Metadata> {
  const { description } = await getShopConfig()
  return { title: SHIRT.name, description }
}

// Prices and sold-out flags are edited in the admin, so never prerender.
export const dynamic = "force-dynamic"

export default async function ShopPage() {
  const config = await getShopConfig()
  const available = config.sizes.filter((s) => !s.soldOut)
  const prices = (available.length ? available : config.sizes).map(
    (s) => s.priceCents
  )
  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <span>Shop</span>
        </nav>

        <div className={styles.layout}>
          <div className={styles.gallery}>
            <Image
              src={SHIRT.image}
              alt="Black t-shirt with the Respect Da City Cuh graphic in green and white"
              width={954}
              height={1112}
              priority
              sizes="(min-width: 860px) 560px, 100vw"
            />
          </div>

          <section className={styles.info} aria-labelledby="product-title">
            <span className={styles.badge}>863 Athletics Merch</span>
            <h1 id="product-title" className={styles.title}>
              Respect Da <span>City</span> Cuh
            </h1>
            <p className={styles.price}>
              {available.length === 0 ? (
                "Sold out"
              ) : (
                <>
                  {formatCents(lowest)}
                  {highest !== lowest && (
                    <small>– {formatCents(highest)} by size</small>
                  )}
                </>
              )}
            </p>
            <p className={styles.desc}>{config.description}</p>

            <ShirtPurchase {...config} />

            <ul className={styles.points}>
              <li>Pick your size above — price shown on each size</li>
              <li>Pay securely by card, Apple Pay or Google Pay</li>
              <li>
                {config.pickupEnabled && !config.shippingEnabled
                  ? "Local pickup only — address shown before you pay"
                  : config.pickupEnabled
                    ? "Ship to your door or pick up locally"
                    : "Shipping address collected at checkout"}
              </li>
              <li>Order confirmation emailed right after payment</li>
            </ul>
            <p className={styles.help}>
              Questions about sizing or an order? <Link href="/contact">Contact us</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

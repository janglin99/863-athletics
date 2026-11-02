"use client"

import { useState } from "react"
import { formatCents } from "@/lib/utils/format"
import { MAX_QUANTITY } from "@/lib/shop/products"
import type { ShopConfig } from "@/lib/shop/config"
import styles from "./shop.module.css"

export function ShirtPurchase({
  sizes,
  shippingCents,
  shippingEnabled,
  pickupEnabled,
  pickupAddress,
}: ShopConfig) {
  const [sizeCode, setSizeCode] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [fulfillment, setFulfillment] = useState<"ship" | "pickup">(
    shippingEnabled ? "ship" : "pickup"
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const size = sizes.find((s) => s.code === sizeCode) ?? null
  const subtotal = size ? size.priceCents * quantity : 0
  const isPickup = fulfillment === "pickup"
  const deliveryCents = isPickup ? 0 : shippingCents

  async function checkout() {
    if (!size) {
      setError("Please choose a size.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: size.code, quantity, fulfillment }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout failed")
      window.location.href = json.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
      setLoading(false)
    }
  }

  return (
    <div className={styles.purchase}>
      <fieldset className={styles.sizes}>
        <legend className={styles.label}>
          Size {size && <span className={styles.labelValue}>— {size.label}</span>}
        </legend>
        <div className={styles.sizeGrid}>
          {sizes.map((s) => (
            <label key={s.code} className={styles.sizeOption}>
              <input
                disabled={s.soldOut}
                type="radio"
                name="size"
                value={s.code}
                checked={sizeCode === s.code}
                onChange={() => {
                  setSizeCode(s.code)
                  setError(null)
                }}
              />
              <span className={styles.sizePill}>
                <strong>{s.code}</strong>
                <small>{s.soldOut ? "Sold out" : formatCents(s.priceCents)}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {shippingEnabled && pickupEnabled && (
        <fieldset className={styles.sizes}>
          <legend className={styles.label}>Delivery</legend>
          <div className={styles.methodGrid}>
            {(["ship", "pickup"] as const).map((m) => (
              <label key={m} className={styles.sizeOption}>
                <input
                  type="radio"
                  name="fulfillment"
                  value={m}
                  checked={fulfillment === m}
                  onChange={() => setFulfillment(m)}
                />
                <span className={styles.sizePill}>
                  <strong>{m === "ship" ? "Ship to me" : "Local pickup"}</strong>
                  <small>
                    {m === "ship"
                      ? shippingCents > 0
                        ? formatCents(shippingCents)
                        : "Free"
                      : "Free"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {isPickup && (
        <div className={styles.pickupBox}>
          <span className={styles.label}>
            {shippingEnabled ? "Pickup location" : "Pickup only — no shipping"}
          </span>
          <address>{pickupAddress}</address>
        </div>
      )}

      <div className={styles.qtyRow}>
        <span className={styles.label}>Quantity</span>
        <div className={styles.stepper}>
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
          >
            −
          </button>
          <output aria-live="polite">{quantity}</output>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            disabled={quantity >= MAX_QUANTITY}
          >
            +
          </button>
        </div>
      </div>

      <dl className={styles.summary}>
        <div>
          <dt>Subtotal</dt>
          <dd>{size ? formatCents(subtotal) : "—"}</dd>
        </div>
        <div>
          <dt>{isPickup ? "Pickup" : "Shipping"}</dt>
          <dd>{deliveryCents > 0 ? formatCents(deliveryCents) : "Free"}</dd>
        </div>
        <div className={styles.total}>
          <dt>Total</dt>
          <dd>{size ? formatCents(subtotal + deliveryCents) : "—"}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <button
        type="button"
        className={styles.buy}
        onClick={checkout}
        disabled={loading}
      >
        {loading ? "Redirecting to checkout…" : "Buy now"}
      </button>
      <p className={styles.secure}>
        Secure checkout powered by Stripe.{" "}
        {isPickup ? "A confirmation email is sent after payment." : "Ships within the U.S."}
      </p>
    </div>
  )
}

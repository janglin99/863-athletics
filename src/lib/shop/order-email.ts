import type Stripe from "stripe"
import { sendEmail } from "@/lib/resend/client"
import { FACILITY } from "@/lib/constants/facility"
import { formatCents } from "@/lib/utils/format"
import { SHIRT } from "./products"

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function formatAddress(a: Stripe.Address | null | undefined) {
  if (!a) return null
  return [
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n")
}

// Sends the customer's order confirmation for a paid shop Checkout Session.
// Returns true if an email was sent (or deduped by Resend), false if skipped.
// Throws when Resend reports an error so the webhook can ask Stripe to retry.
export async function sendShopOrderEmail(session: Stripe.Checkout.Session) {
  const to = session.customer_details?.email
  if (!to) return false

  const size = session.metadata?.size ?? ""
  const quantity = Number(session.metadata?.quantity ?? 1)
  const isPickup = session.metadata?.fulfillment === "pickup"
  const total = session.amount_total ?? 0
  const shippingCents = session.total_details?.amount_shipping ?? 0
  const subtotal = total - shippingCents
  const orderRef = session.id.slice(-8).toUpperCase()
  const firstName = session.customer_details?.name?.split(" ")[0]

  const shipTo = formatAddress(
    session.collected_information?.shipping_details?.address
  )
  const pickupAddress = session.metadata?.pickup_address

  const itemLine = `${SHIRT.name} — Size ${size} × ${quantity}`
  const deliveryTitle = isPickup ? "Pickup location" : "Shipping to"
  const deliveryBody = isPickup ? pickupAddress : shipTo
  const deliveryNote = isPickup
    ? "This order is pickup only — nothing will be shipped. Questions about pickup? Contact us below."
    : "Your order will be shipped to the address above."

  const subject = `Order confirmed — ${SHIRT.name} (#${orderRef})`

  const text = [
    `${firstName ? `Hi ${firstName}` : "Hi"},`,
    "",
    `Thanks for your order! Here are the details.`,
    "",
    `Order #${orderRef}`,
    itemLine,
    `Subtotal: ${formatCents(subtotal)}`,
    isPickup ? "Delivery: Pickup (free)" : `Shipping: ${formatCents(shippingCents)}`,
    `Total paid: ${formatCents(total)}`,
    "",
    ...(deliveryBody ? [`${deliveryTitle}:`, deliveryBody, ""] : []),
    deliveryNote,
    "",
    `Questions? Call ${FACILITY.phone} or visit ${FACILITY.website}/contact`,
    "",
    `— ${FACILITY.name}`,
  ].join("\n")

  const html = `<!doctype html><html><body style="margin:0;background:#070907;font-family:Arial,Helvetica,sans-serif;color:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070907"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1a0f;border:1px solid #1f6b1f;border-radius:14px">
<tr><td style="padding:24px 24px 8px"><div style="font-size:12px;letter-spacing:2px;color:#3ee63e;font-weight:700">${esc(FACILITY.name.toUpperCase())}</div>
<h1 style="margin:8px 0 4px;font-size:26px">Order confirmed</h1>
<div style="color:#a9b8a9;font-size:14px">${firstName ? `Thanks, ${esc(firstName)}! ` : ""}Order #${orderRef}</div></td></tr>
<tr><td style="padding:16px 24px">
<div style="border-top:1px solid #1f6b1f;padding-top:16px;font-size:15px">${esc(itemLine)}</div>
<table role="presentation" width="100%" style="margin-top:12px;font-size:14px;color:#a9b8a9">
<tr><td>Subtotal</td><td align="right" style="color:#fff">${formatCents(subtotal)}</td></tr>
<tr><td>${isPickup ? "Delivery (pickup)" : "Shipping"}</td><td align="right" style="color:#fff">${isPickup ? "Free" : formatCents(shippingCents)}</td></tr>
<tr><td style="padding-top:8px;color:#fff;font-weight:700">Total paid</td><td align="right" style="padding-top:8px;color:#3ee63e;font-weight:700;font-size:16px">${formatCents(total)}</td></tr>
</table></td></tr>
${deliveryBody ? `<tr><td style="padding:0 24px 8px"><div style="background:#070907;border:1px solid #1f6b1f;border-radius:10px;padding:14px">
<div style="font-size:12px;letter-spacing:1px;color:#3ee63e;font-weight:700;text-transform:uppercase">${deliveryTitle}</div>
<div style="margin-top:6px;font-size:15px;line-height:1.5;white-space:pre-line">${esc(deliveryBody)}</div></div></td></tr>` : ""}
<tr><td style="padding:12px 24px 24px;font-size:13px;color:#a9b8a9;line-height:1.5">${esc(deliveryNote)}<br><br>Questions? Call ${esc(FACILITY.phone)} or visit ${esc(FACILITY.website)}/contact</td></tr>
</table></td></tr></table></body></html>`

  const result = await sendEmail({
    to,
    subject,
    text,
    html,
    // One email per Checkout Session even if Stripe retries the webhook.
    idempotencyKey: `shop-order-${session.id}`,
  })
  if (result?.error) {
    throw new Error(`Resend failed: ${result.error.message}`)
  }
  return Boolean(result)
}

// Internal "new order" alert to the admin inbox (ADMIN_EMAIL). No-op when the
// env var isn't set. Throws on a Resend error; the caller treats it as
// best-effort so an alert problem never blocks the customer's confirmation.
export async function sendShopOrderAlert(session: Stripe.Checkout.Session) {
  const to = process.env.ADMIN_EMAIL
  if (!to) return false

  const size = session.metadata?.size ?? ""
  const quantity = Number(session.metadata?.quantity ?? 1)
  const isPickup = session.metadata?.fulfillment === "pickup"
  const shippingCents = session.total_details?.amount_shipping ?? 0
  const total = session.amount_total ?? 0
  const orderRef = session.id.slice(-8).toUpperCase()
  const c = session.customer_details
  const shipTo = formatAddress(
    session.collected_information?.shipping_details?.address
  )
  const paymentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null

  const text = [
    `New shirt order #${orderRef}`,
    "",
    `${SHIRT.name} — Size ${size} × ${quantity}`,
    `Total paid: ${formatCents(total)}${isPickup ? "" : ` (incl. ${formatCents(shippingCents)} shipping)`}`,
    "",
    `Customer: ${c?.name ?? "—"}`,
    `Email: ${c?.email ?? "—"}`,
    `Phone: ${c?.phone ?? "—"}`,
    "",
    isPickup
      ? `PICKUP ORDER — nothing to ship.\nPickup location: ${session.metadata?.pickup_address ?? "—"}`
      : `SHIP TO:\n${shipTo ?? "—"}`,
    "",
    paymentId
      ? `Stripe: https://dashboard.stripe.com/payments/${paymentId}`
      : `Stripe session: ${session.id}`,
  ].join("\n")

  const result = await sendEmail({
    to,
    subject: `New shirt order #${orderRef} — ${size} × ${quantity} (${isPickup ? "pickup" : "ship"}) ${formatCents(total)}`,
    text,
    idempotencyKey: `shop-order-admin-${session.id}`,
  })
  if (result?.error) {
    throw new Error(`Resend failed: ${result.error.message}`)
  }
  return Boolean(result)
}

import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripeServer() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    })
  }
  return _stripe
}

// Named export for backward compat
export const stripe = {
  get customers() { return getStripeServer().customers },
  get paymentIntents() { return getStripeServer().paymentIntents },
  get webhooks() { return getStripeServer().webhooks },
} as unknown as Stripe

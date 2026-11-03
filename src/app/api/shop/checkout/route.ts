import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getStripeServer } from "@/lib/stripe/server"
import { MAX_QUANTITY, SHIRT } from "@/lib/shop/products"
import { getShopConfig } from "@/lib/shop/config"

const schema = z.object({
  size: z.string(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  fulfillment: z.enum(["ship", "pickup"]).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const config = await getShopConfig()
  const size = config.sizes.find((s) => s.code === parsed.data.size)
  if (!size) {
    return NextResponse.json({ error: "Unknown size" }, { status: 400 })
  }
  if (size.soldOut) {
    return NextResponse.json(
      { error: `Size ${size.code} is sold out` },
      { status: 409 }
    )
  }
  const { quantity } = parsed.data

  // Default to whichever single method is enabled; require a choice if both.
  const fulfillment =
    parsed.data.fulfillment ??
    (config.shippingEnabled && !config.pickupEnabled ? "ship" : undefined) ??
    (config.pickupEnabled && !config.shippingEnabled ? "pickup" : undefined)
  const allowed =
    (fulfillment === "ship" && config.shippingEnabled) ||
    (fulfillment === "pickup" && config.pickupEnabled)
  if (!fulfillment || !allowed) {
    return NextResponse.json(
      { error: "Please choose a valid delivery option" },
      { status: 400 }
    )
  }
  const isPickup = fulfillment === "pickup"

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  try {
    const session = await getStripeServer().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            unit_amount: size.priceCents,
            product_data: {
              name: `${SHIRT.name} — ${size.label}`,
              images: [`${origin}${SHIRT.image}`],
              metadata: { product: SHIRT.slug, size: size.code },
            },
          },
        },
      ],
      ...(isPickup
        ? {
            custom_text: {
              submit: {
                message: `Pickup only — no shipping. Pick up at:\n${config.pickupAddress}`,
              },
            },
          }
        : {
            shipping_address_collection: { allowed_countries: ["US"] },
            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount" as const,
                  display_name: "Standard shipping",
                  fixed_amount: {
                    amount: config.shippingCents,
                    currency: "usd",
                  },
                },
              },
            ],
          }),
      phone_number_collection: { enabled: true },
      metadata: {
        product: SHIRT.slug,
        size: size.code,
        quantity: String(quantity),
        fulfillment,
        // Snapshot at purchase time so later address edits don't rewrite history.
        ...(isPickup && { pickup_address: config.pickupAddress }),
      },
      payment_intent_data: {
        description: `${SHIRT.name} (${size.code}) x${quantity}`,
        metadata: { product: SHIRT.slug, size: size.code },
      },
      success_url: `${origin}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Shop checkout error:", error)
    // TEMPORARY diagnostics: surface Stripe's error type/code so a failing
    // production checkout can be identified from the browser. Remove once fixed.
    const e = error as { type?: string; code?: string; message?: string }
    return NextResponse.json(
      {
        error: "Could not start checkout. Please try again.",
        debug: { type: e.type, code: e.code, message: e.message },
      },
      { status: 500 }
    )
  }
}

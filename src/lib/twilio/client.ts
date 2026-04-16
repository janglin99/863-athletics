import twilio from "twilio"

let twilioClient: ReturnType<typeof twilio> | null = null

export function getTwilioClient() {
  if (
    !twilioClient &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  ) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  }
  return twilioClient
}

export async function sendSMS(to: string, body: string) {
  const client = getTwilioClient()
  if (!client) return null
  return client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  })
}

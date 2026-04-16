import { Resend } from "resend"

let resendClient: Resend | null = null

export function getResendClient() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html?: string
}) {
  const client = getResendClient()
  if (!client) return null
  return client.emails.send({
    from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  })
}

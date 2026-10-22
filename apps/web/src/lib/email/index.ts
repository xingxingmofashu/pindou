/** A transactional email with a plain-text fallback and optional HTML body. */
export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Whether password-reset emails can be delivered in the current environment.
 *
 * Development always uses the console transport. Production requires both a
 * Resend API key and a verified sender address.
 *
 * @returns `true` when {@link sendEmail} has a usable transport.
 */
export function isEmailDeliveryConfigured(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
  )
}

/**
 * Send a transactional email.
 *
 * In development the message (including the reset link) is printed to the
 * server console so the flow can be tested without an email provider. In
 * production the Resend REST API is used when configured; otherwise the
 * message is dropped and only an error is logged, so reset tokens never leak
 * into production logs.
 *
 * @param message - Recipient, subject, and body of the email.
 * @returns A promise that resolves once the transport has accepted the message.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[email] to=${message.to}\nsubject=${message.subject}\n\n${message.text}`,
    )
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.error("[email] RESEND_API_KEY / EMAIL_FROM is not configured; email dropped")
    return
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })

  if (!response.ok) {
    console.error(`[email] Resend request failed with status ${response.status}`)
  }
}

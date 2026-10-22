import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer, oauthPopup } from "better-auth/plugins"
import { after } from "next/server"
import { I18nConfig, type Locale } from "@pindou/core/i18n/config"
import { db } from "@/db"
import { sendEmail } from "@/lib/email"
import { passwordResetEmail } from "@/lib/email/templates/password-reset"

const baseURL = process.env.BETTER_AUTH_URL!
const secret = process.env.BETTER_AUTH_SECRET!

/** Resolve the locale from the page that submitted the request. */
function localeFromRequest(request?: Request): Locale {
  const referer = request?.headers.get("referer")
  if (!referer) return I18nConfig.defaultLocale

  try {
    const segment = new URL(referer).pathname.split("/")[1]
    return segment && I18nConfig.isLocale(segment) ? segment : I18nConfig.defaultLocale
  } catch {
    return I18nConfig.defaultLocale
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  baseURL,
  secret,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Deferred until a transactional email provider is configured. Once
    // `emailVerification.sendVerificationEmail` is wired up, flip this on.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }, request) => {
      const locale = localeFromRequest(request)
      const mail = passwordResetEmail({ url, locale })
      // Schedule after the response: avoids a timing side-channel and keeps
      // the email alive on serverless platforms via Next's waitUntil.
      after(async () => {
        try {
          await sendEmail({ to: user.email, ...mail })
        } catch (error) {
          console.error("[auth] failed to send password reset email", error)
        }
      })
    },
  },
  account: {
    accountLinking: {
      disableImplicitLinking: true,
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [baseURL],
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
    },
  },
  plugins: [bearer(), oauthPopup(), nextCookies()],
})

export type Session = typeof auth.$Infer.Session

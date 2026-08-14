import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer, oauthPopup } from "better-auth/plugins"
import { db } from "@/db"

const baseURL = process.env.BETTER_AUTH_URL!
const secret = process.env.BETTER_AUTH_SECRET!

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  baseURL,
  secret,
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [baseURL],
  plugins: [nextCookies(), bearer(), oauthPopup()],
})

export type Session = typeof auth.$Infer.Session

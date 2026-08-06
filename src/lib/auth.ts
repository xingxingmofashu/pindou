import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session

"use client"

import { createAuthClient } from "better-auth/react"
import { oauthPopupClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [oauthPopupClient()],
})

export const { signIn, signOut, useSession } = authClient

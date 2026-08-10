"use client"

import Link from "next/link"
import { UserMenu } from "@/components/auth/user-menu"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth/client"
import { localizedPath } from "@/i18n/config"
import { useI18n } from "@/i18n/client"

/** Session-aware auth area: shows the sign-in link or the user menu. */
export function AuthNav() {
  const { data: session, isPending } = useSession()
  const { locale, t } = useI18n()

  // SSR and first client render have no session yet — keep layout stable.
  if (isPending) {
    return (
      <Button variant="link" size="sm" aria-disabled className="pointer-events-none opacity-50">
        {t("header.signIn")}
      </Button>
    )
  }

  if (session) {
    return <UserMenu name={session.user.name} />
  }

  return (
    <Button
      variant="link"
      nativeButton={false}
      render={<Link href={localizedPath(locale, "/sign-in")} />}
    >
      {t("header.signIn")}
    </Button>
  )
}

"use client"

import { useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@pindou/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@pindou/ui/components/ui/dropdown-menu"
import { useSession, signOut } from "@/lib/auth/client"
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

/** Signed-in user menu: name + sign-out. */
function UserMenu({ name }: { name: string }) {
  const router = useRouter()
  const { t } = useI18n()

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.refresh()
  }, [router])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="link" size="sm">
            <span className="max-w-[8rem] truncate">{name}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

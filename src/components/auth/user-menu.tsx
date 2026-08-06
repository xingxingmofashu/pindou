"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth-client"

interface UserMenuProps {
  name: string
  image?: string | null
}

export function UserMenu({ name, image }: UserMenuProps) {
  const router = useRouter()

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.refresh()
  }, [router])

  return (
    <div className="flex items-center gap-2">
      {image ? (
        <Image
          src={image}
          alt=""
          width={24}
          height={24}
          unoptimized
          referrerPolicy="no-referrer"
          className="size-6 rounded-full"
        />
      ) : (
        <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="max-w-[10rem] truncate text-sm">{name}</span>
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  )
}

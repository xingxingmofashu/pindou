"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth-client"

interface UserMenuProps {
  name: string
}

export function UserMenu({ name }: UserMenuProps) {
  const router = useRouter()

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
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"
import { useI18n } from "@pindou/core/i18n/client.tsx"

interface UnsavedChangesGuardProps {
  /** Whether there is unsaved canvas content. */
  dirty: boolean
  /**
   * Navigates to the confirmed href — injected by the host app (e.g. Next.js
   * `useRouter().push`) so this guard stays framework-agnostic.
   */
  onNavigate: (href: string) => void
}

/**
 * Warns before the editor loses unsaved canvas content.
 *
 * - Full page unloads (refresh, tab close, external navigation) use the
 *   browser's native `beforeunload` "leave site?" dialog — the only mechanism
 *   browsers permit there.
 * - In-app `<Link>` navigation is intercepted and replaced with a shadcn
 *   AlertDialog, because Next.js client-side transitions never fire
 *   `beforeunload`.
 */
export function UnsavedChangesGuard({ dirty, onNavigate }: UnsavedChangesGuardProps) {
  const { t } = useI18n()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // Capture-phase guard: cancel the original navigation (Next.js Link's client
  // transition would otherwise proceed) and surface a confirm dialog instead.
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest?.("a")
      if (!anchor) return
      // New-tab / download links don't lose editor state.
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return
      const href = anchor.getAttribute("href")
      if (!href) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      // Only guard same-origin page navigations (skip external links).
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      e.preventDefault()
      e.stopPropagation()
      setPendingHref(url.pathname + url.search + url.hash)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [dirty])

  const handleConfirm = useCallback(() => {
    const href = pendingHref
    setPendingHref(null)
    if (href) onNavigate(href)
  }, [pendingHref, onNavigate])

  return (
    <AlertDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("editor.leaveWarningTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("editor.leaveWarning")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{t("common.leave")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@pindou/ui/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
} from "@pindou/ui/components/ui/drawer"
import { useI18n } from "@pindou/core/i18n/client"
import { localizedPath, type Locale } from "@pindou/core/i18n/config"
import { GITHUB_URL } from "@pindou/shared/constants"

/** Shared nav-item styles: full-width row with 24px medium label. */
const navItemClass =
  "flex items-center rounded-md px-3 py-2 text-2xl font-medium text-foreground transition-colors hover:bg-muted"

/** The main navigation targets, reused by both the inline and drawer forms. */
const NAV_ITEMS = [
  { path: "/", labelKey: "header.home" },
  { path: "/patterns", labelKey: "header.patterns" },
  { path: "/editor", labelKey: "header.editor" },
  { path: "/download", labelKey: "header.download" },
] as const

/**
 * Main site navigation, shared by mobile and desktop in one component:
 * - below `md:` a hamburger button opens a left-side drawer (which becomes an
 *   X while open, so the header stays minimal)
 * - from `md:` up the same links render inline in the header
 * Both forms reuse {@link NAV_ITEMS} so the routes stay in sync.
 */
export function NavMenu({ locale }: { locale: Locale }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop inline nav — patterns + editor only (home and download
          live in the mobile drawer / footer). */}
      <nav className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.slice(1, 3).map(({ path, labelKey }) => (
          <Button
            key={path}
            variant="link"
            nativeButton={false}
            render={<Link href={localizedPath(locale, path)} />}
          >
            {t(labelKey)}
          </Button>
        ))}
      </nav>

      {/* Mobile drawer nav — slides in from the left, full width, below the
          header (the page header stays visible and clickable). */}
      <Drawer open={open} onOpenChange={setOpen} swipeDirection="left" modal={false}>
        {open ? (
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="md:hidden"
                aria-label={t("common.close")}
              >
                <X data-icon="inline-start" />
              </Button>
            }
          />
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            className="md:hidden"
            aria-label={t("header.menuAria")}
            onClick={() => setOpen(true)}
          >
            <Menu data-icon="inline-start" />
          </Button>
        )}

        <DrawerContent className="w-full! p-0 data-[swipe-axis=x]:top-[46px]! data-[swipe-axis=x]:bottom-0!">
          {/* Content: primary routes */}
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-6 py-6">
            {NAV_ITEMS.map(({ path, labelKey }) => (
              <DrawerClose
                key={path}
                nativeButton={false}
                render={<Link href={localizedPath(locale, path)} className={navItemClass} />}
              >
                {t(labelKey)}
              </DrawerClose>
            ))}
          </nav>

          {/* Footer: GitHub */}
          <DrawerFooter className="p-6 pt-2">
            <DrawerClose
              nativeButton={false}
              render={
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={navItemClass} />
              }
            >
              {t("header.github")}
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

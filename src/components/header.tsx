import Link from "next/link"
import { Logo } from "@/components/logo"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-10 items-center justify-between px-4">
        <Link href="/" className="flex items-center" aria-label="PINDOW home">
          <Logo className="h-5 w-auto" />
        </Link>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink
                render={<Link href="/editor" />}
                className={navigationMenuTriggerStyle()}
              >
                Editor
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  )
}

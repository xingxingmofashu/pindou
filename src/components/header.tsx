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
    <header className="flex items-center justify-between px-3 py-2 border">
      <Link href="/" className="flex items-center" aria-label="PINDOW home">
        <Logo className="h-5 w-auto" />
      </Link>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink
              render={<Link href="/patterns" />}
              className={navigationMenuTriggerStyle()}
            >
              Patterns
            </NavigationMenuLink>
          </NavigationMenuItem>
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
    </header>
  )
}

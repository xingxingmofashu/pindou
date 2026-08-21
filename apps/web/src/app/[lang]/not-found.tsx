import Link from "next/link"
import { Button } from "@pindou/ui/components/ui/button"
import { Logo } from "@pindou/ui/components/logo"
import { localizedPath } from "@/i18n/config"
import { getDictionary, getLocale } from "@/i18n/server"

export default async function NotFound() {
  const locale = await getLocale()
  const dict = await getDictionary()

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <Logo className="h-10 w-48" />
      <div>
        <h1 className="text-2xl font-semibold">{dict.common.pageNotFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {dict.common.pageNotFoundDescription}
        </p>
      </div>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={localizedPath(locale, "/")} />}
      >
        {dict.common.goHome}
      </Button>
    </div>
  )
}

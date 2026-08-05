import Link from "next/link"
import { Download, ImageUp, Palette, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Logo } from "@/components/logo"

const FEATURES = [
  {
    icon: ImageUp,
    title: "Import any image",
    description: "Upload a photo and auto-convert it into a bead grid — no hand tracing.",
  },
  {
    icon: Palette,
    title: "Real bead palettes",
    description: "MARD, PERLER, ARTKAL & HAMA — 560+ colours matched to the beads you own.",
  },
  {
    icon: Download,
    title: "Printable chart",
    description: "Export a high-resolution PNG with grid lines and colour codes.",
  },
  {
    icon: Share2,
    title: "Publish anonymously",
    description: "Share your pattern with the community. No account, no signup.",
  },
]

export default function HomePage() {
  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">Pindou</h1>
          <p className="text-[10px] text-muted-foreground">
            Fuse bead pattern editor &amp; community
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <section className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <Logo className="h-24 w-auto" />
            <h2 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
              Fuse bead patterns, made pixel-perfect
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Draw on an infinite canvas with real bead palettes, convert any image
              into a grid, and export a printable chart. Publish anonymously — no
              account needed.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Button render={<Link href="/editor" />} nativeButton={false} size="lg">
                Open Editor
              </Button>
              <Button render={<Link href="/patterns" />} variant="outline" nativeButton={false} size="lg">
                Browse Patterns
              </Button>
            </div>
          </section>

          <section className="border-t bg-muted/30">
            <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <Card key={title}>
                  <CardHeader>
                    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    <CardTitle className="text-sm">{title}</CardTitle>
                    <CardDescription className="text-xs">{description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

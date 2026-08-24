import { useEffect, useState } from "react"

/** Card preview: the pattern's rendered thumbnail, or a brand colour-strip
 *  fallback while loading / when the thumbnail is missing. */
export function PatternThumb({
  patternId,
  colors,
}: {
  patternId: string
  colors: { code: string; hex: string }[]
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.pindou.patterns.thumbnail(patternId).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [patternId])

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="block aspect-square w-full bg-muted object-cover [image-rendering:pixelated]"
        onError={() => setSrc(null)}
      />
    )
  }

  return (
    <div className="flex h-24 items-stretch overflow-hidden">
      {colors.slice(0, 8).map((c) => (
        <div key={c.code} className="flex-1" style={{ backgroundColor: c.hex }} />
      ))}
    </div>
  )
}

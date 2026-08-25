import { useEffect, useState } from "react"

/** 1×1 transparent GIF — placeholder `src` for a failed/empty thumbnail. */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

/** Card preview: the pattern's rendered thumbnail, loaded from disk via IPC.
 *  Mirrors the web catalog card — the image element is always rendered (so the
 *  card keeps its flush-top rounded corners) and swaps in a transparent
 *  placeholder when missing, instead of flashing a colour-strip fallback. */
export function PatternThumb({
  patternId,
}: {
  patternId: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.pindou.patterns.thumbnail(patternId).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [patternId])

  return (
    <img
      src={src && !failed ? src : TRANSPARENT_PIXEL}
      alt=""
      className="block aspect-square w-full bg-muted object-cover [image-rendering:pixelated]"
      onError={() => setFailed(true)}
    />
  )
}

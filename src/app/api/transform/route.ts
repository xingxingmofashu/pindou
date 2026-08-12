import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { MAX_GRID_DIMENSION } from "@/lib/editor"
import { Transform, InputImageTooLargeError, MAX_INPUT_PIXELS } from "@/lib/transform"
import { rateLimit } from "@/lib/rate-limit"
import { getPaletteByCode } from "@/lib/server/palettes"

export const runtime = "nodejs"

/** Per-IP budget for the CPU-heavy image transform. */
const LIMIT = 20
const WINDOW_MS = 60_000
/** Maximum upload size in bytes — reject before parsing the multipart body. */
const MAX_FILE_BYTES = 10 * 1024 * 1024

const ConvertRequestSchema = z.object({
  width: z.coerce.number().int().min(1).max(MAX_GRID_DIMENSION),
  brandCode: z.string(),
  mode: z.enum(["average", "dominant"]).default("average"),
  mergeSimilarity: z.coerce.number().min(0).max(1).default(0),
  removeBackground: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Colour codes to exclude from quantization, sent as a JSON array string. */
  excludedCodes: z
    .string()
    .default("[]")
    .transform((v) => {
      try {
        const arr = JSON.parse(v)
        return Array.isArray(arr)
          ? arr.filter((x): x is string => typeof x === "string")
          : []
      } catch {
        return []
      }
    }),
})

export async function POST(request: NextRequest) {
  // On Vercel the edge overwrites `x-forwarded-for`, so the leftmost value is
  // trustworthy there. On other hosts (or direct access) it's client-spoofable
  // and the budget can be bypassed by rotating values — accept as best-effort.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!(await rateLimit(`ip:${ip}`, LIMIT, WINDOW_MS))) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 })
  }

  const contentLength = Number(request.headers.get("content-length"))
  if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const file = formData.get("file")
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No image provided" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 })
  }

  const parsed = ConvertRequestSchema.safeParse({
    width: formData.get("width"),
    brandCode: formData.get("brandCode"),
    mode: formData.get("mode") ?? "average",
    mergeSimilarity: formData.get("mergeSimilarity") ?? 0,
    removeBackground: formData.get("removeBackground") ?? "false",
    excludedCodes: formData.get("excludedCodes") ?? "[]",
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const palette = await getPaletteByCode(parsed.data.brandCode, parsed.data.excludedCodes)
  if (!palette) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 })
  }
  if (palette.colors.length === 0) {
    return NextResponse.json({ error: "No colours left to convert" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await new Transform(palette).convert(buffer, {
      width: parsed.data.width,
      mode: parsed.data.mode,
      mergeSimilarity: parsed.data.mergeSimilarity,
      removeBackground: parsed.data.removeBackground,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof InputImageTooLargeError) {
      return NextResponse.json(
        { error: `Image is too large — max ${MAX_INPUT_PIXELS} pixels` },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: "Failed to convert image" }, { status: 500 })
  }
}

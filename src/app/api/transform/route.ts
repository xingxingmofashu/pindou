import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors } from "@/db/schema"
import { MAX_GRID_DIMENSION } from "@/lib/editor"
import { transform } from "@/lib/image/transform"
import type { Palette } from "@/types"

export const runtime = "nodejs"

const ConvertRequestSchema = z.object({
  width: z.coerce.number().int().min(1).max(MAX_GRID_DIMENSION),
  brandCode: z.string(),
  mode: z.enum(["average", "dominant"]).default("average"),
  mergeSimilarity: z.coerce.number().min(0).max(1).default(0),
  removeBackground: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
})

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const file = formData.get("file")
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No image provided" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 })
  }

  const parsed = ConvertRequestSchema.safeParse({
    width: formData.get("width"),
    brandCode: formData.get("brandCode"),
    mode: formData.get("mode") ?? "average",
    mergeSimilarity: formData.get("mergeSimilarity") ?? 0,
    removeBackground: formData.get("removeBackground") ?? "false",
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const [brand] = await db
    .select()
    .from(brands)
    .where(eq(brands.code, parsed.data.brandCode))
    .limit(1)
  if (!brand) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 })
  }

  const colorRows = await db
    .select()
    .from(colors)
    .where(eq(colors.fkBrandId, brand.id))
    .orderBy(colors.sortOrder)

  const palette: Palette = { ...brand, colors: colorRows }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await transform(buffer, {
      width: parsed.data.width,
      palette,
      mode: parsed.data.mode,
      mergeSimilarity: parsed.data.mergeSimilarity,
      removeBackground: parsed.data.removeBackground,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Failed to convert image" }, { status: 500 })
  }
}

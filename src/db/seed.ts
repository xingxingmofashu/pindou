import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors } from "@/db/schema"
import { MARD_PALETTE } from "@/lib/palette/brand/mard"
import { PERLER_PALETTE } from "@/lib/palette/brand/perler"
import { ARTKAL_PALETTE } from "@/lib/palette/brand/artkal"
import { HAMA_PALETTE } from "@/lib/palette/brand/hama"
import type { SeedPalette } from "@/types"

/**
 * Seed the `brands` + `colors` tables from the static palette definitions.
 *
 * Idempotent: brands are matched by `code` (their existing UUID is kept), and
 * colors already present for a brand are skipped. Colors are inserted with
 * `sortOrder` = the array index so the served palette order exactly matches the
 * definitions — grid cells are 1‑based indices into that array, so reordering
 * would corrupt every published pattern. After inserting, each brand's colors
 * are read back and their codes compared against the source order as a guard.
 */
const palettes: SeedPalette[] = [MARD_PALETTE, PERLER_PALETTE, ARTKAL_PALETTE, HAMA_PALETTE]

async function main(): Promise<void> {
  for (const p of palettes) {
    const [existing] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.code, p.code))
      .limit(1)

    let brandId: string
    if (existing) {
      brandId = existing.id
    } else {
      const [inserted] = await db
        .insert(brands)
        .values({ code: p.code, name: p.brand })
        .returning({ id: brands.id })
      brandId = inserted.id
    }

    const knownCodes = await db
      .select({ code: colors.code })
      .from(colors)
      .where(eq(colors.fkBrandId, brandId))
    const known = new Set(knownCodes.map((r) => r.code))

    const rows = p.colors
      .map((c, i) => ({
        fkBrandId: brandId,
        code: c.code,
        name: c.name,
        hex: c.hex,
        series: c.series ?? null,
        sortOrder: i,
      }))
      .filter((r) => !known.has(r.code))
    if (rows.length > 0) {
      await db.insert(colors).values(rows)
    }
  }

  for (const p of palettes) {
    const [brand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.code, p.code))
      .limit(1)
    if (!brand) throw new Error(`Brand "${p.code}" missing after seed`)

    const readBack = await db
      .select({ code: colors.code })
      .from(colors)
      .where(eq(colors.fkBrandId, brand.id))
      .orderBy(colors.sortOrder)
    const expected = p.colors.map((c) => c.code)
    const actual = readBack.map((r) => r.code)
    if (actual.length !== expected.length || actual.some((code, i) => code !== expected[i])) {
      throw new Error(
        `Color order mismatch for brand "${p.code}": expected ${expected.length} colors, got ${actual.length}`,
      )
    }
    console.log(`✓ ${p.code}: ${actual.length} colors, order matches`)
  }
}

main()
  .then(() => {
    console.log("Seed complete")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })

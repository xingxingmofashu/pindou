import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/db"
import { patterns } from "@/db/schema"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { title, description, author_name, grid, brand_id, bead_stats } = body as {
    title?: string
    description?: string
    author_name?: string
    grid?: number[][]
    brand_id?: string
    bead_stats?: Record<string, number>
  }

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }
  if (title.length > 100) {
    return NextResponse.json({ error: "Title must be ≤100 characters" }, { status: 400 })
  }

  if (!Array.isArray(grid) || grid.length === 0) {
    return NextResponse.json({ error: "Grid data is required" }, { status: 400 })
  }
  if (grid.length > 256 || grid[0].length > 256) {
    return NextResponse.json({ error: "Grid exceeds max size 256×256" }, { status: 400 })
  }

  const id = randomUUID()

  db.insert(patterns).values({
    id,
    title: title.trim(),
    description: (description ?? "").slice(0, 280),
    authorName: author_name?.slice(0, 50) ?? null,
    gridData: JSON.stringify(grid),
    beadStats: bead_stats ? JSON.stringify(bead_stats) : "{}",
    brandId: brand_id ?? "mard",
  }).run()

  return NextResponse.json({ id }, { status: 201 })
}

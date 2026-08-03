"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { createPatternSchema, errorResponseSchema } from "@/lib/validation"

interface PublishDialogProps {
  open: boolean
  onClose: () => void
  getCellsData: () => { grid: number[][]; brandId: string } | null
}

export function PublishDialog({ open, onClose, getCellsData }: PublishDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patternId, setPatternId] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    setError(null)

    const data = getCellsData()
    if (!data) {
      setError("Canvas is empty. Draw something first.")
      return
    }

    const parsed = createPatternSchema.safeParse({
      title,
      description: description || undefined,
      author_name: authorName || undefined,
      grid: data.grid,
      brand_id: data.brandId,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      const result = await res.json()
      if (!res.ok) {
        const parsed = errorResponseSchema.safeParse(result)
        setError(parsed.success ? parsed.data.error : "Failed to publish")
        return
      }

      setPatternId(result.id)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [title, description, authorName, getCellsData])

  const handleClose = useCallback(() => {
    setTitle("")
    setDescription("")
    setAuthorName("")
    setError(null)
    setPatternId(null)
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/10 backdrop-blur-xs" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-sm rounded-xl bg-popover p-6 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        {patternId ? (
          <div className="grid gap-4">
            <div>
              <h2 className="font-heading text-base font-medium">Published</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your pattern is live at{" "}
                <code className="rounded bg-muted px-1 text-xs">/patterns/{patternId}</code>
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <h2 className="font-heading text-base font-medium">Publish Pattern</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Share your pattern with the community. Published anonymously.
              </p>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">
                  Title <span className="text-destructive">*</span>
                </span>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="My cool pattern"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  maxLength={280}
                  rows={2}
                  placeholder="Optional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20 resize-none"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Your name</span>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Anonymous"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20"
                />
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || title.trim().length === 0}
              >
                {submitting ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

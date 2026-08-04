"use client"

import { useCallback, useState } from "react"
import useSWRMutation from "swr/mutation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CreatePatternSchema, ErrorSchema } from "@/lib/validation"

interface PublishDialogProps {
  open: boolean
  onClose: () => void
  getCellsData: () => {
    grid: number[][]; brandCode: string; brandId: string; beadStats: string
  } | null
}

export function PublishDialog({ open, onClose, getCellsData }: PublishDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [patternId, setPatternId] = useState<string | null>(null)
  const { trigger, isMutating } = useSWRMutation(
    "/api/patterns",
    async (url, { arg }: { arg: string }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: arg,
      })
      const result = await res.json()
      if (!res.ok) {
        const parsed = ErrorSchema.safeParse(result)
        throw new Error(parsed.success ? parsed.data.error : "Failed to publish")
      }
      return result as { id: string }
    },
  )

  const handleSubmit = useCallback(async () => {
    setError(null)

    const data = getCellsData()
    if (!data) {
      setError("Canvas is empty. Draw something first.")
      return
    }

    const parsed = CreatePatternSchema.safeParse({
      title,
      description,
      authorName,
      gridData: data.grid,
      brandCode: data.brandCode,
      beadStats: data.beadStats,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }

    try {
      const result = await trigger(JSON.stringify(parsed.data))
      setPatternId(result.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error. Please try again.")
    }
  }, [title, description, authorName, getCellsData, trigger])

  const handleClose = useCallback(() => {
    setTitle("")
    setDescription("")
    setAuthorName("")
    setError(null)
    setPatternId(null)
    onClose()
  }, [onClose])

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <AlertDialogContent>
        {patternId ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Published</AlertDialogTitle>
              <AlertDialogDescription>
                Your pattern is live at{" "}
                <code className="rounded bg-muted px-1 text-xs">
                  /patterns/{patternId}
                </code>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleClose}>Close</AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Publish Pattern</AlertDialogTitle>
              <AlertDialogDescription>
                Share your pattern with the community. Published anonymously.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="publish-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="publish-title"
                  type="text"
                  maxLength={100}
                  placeholder="My cool pattern"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="publish-description">Description</Label>
                <Textarea
                  id="publish-description"
                  maxLength={280}
                  rows={2}
                  placeholder="Optional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="publish-author">Your name</Label>
                <Input
                  id="publish-author"
                  type="text"
                  maxLength={50}
                  placeholder="Anonymous"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmit}
                disabled={isMutating || title.trim().length === 0}
              >
                {isMutating ? "Publishing..." : "Publish"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

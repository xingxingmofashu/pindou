"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { PatternInsertSchema, ErrorSchema } from "@/db/schema"
import { GithubIcon } from "@/components/icon/github"
import { useSession } from "@/lib/auth-client"

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
  const [patternId, setPatternId] = useState<string | null>(null)
  const { data: session, isPending } = useSession()
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
    const data = getCellsData()
    if (!data) {
      toast.add({
        type: "error",
        title: "Canvas is empty",
        description: "Draw something first.",
      })
      return
    }

    const parsed = PatternInsertSchema.safeParse({
      title,
      description,
      gridData: data.grid,
      brandCode: data.brandCode,
      beadStats: data.beadStats,
    })
    if (!parsed.success) {
      toast.add({
        type: "error",
        title: "Invalid input",
        description: parsed.error.issues[0]?.message ?? "Invalid input",
      })
      return
    }

    try {
      const result = await trigger(JSON.stringify(parsed.data))
      setPatternId(result.id)
    } catch (e) {
      toast.add({
        type: "error",
        title: "Failed to publish",
        description: e instanceof Error ? e.message : "Network error. Please try again.",
      })
    }
  }, [title, description, getCellsData, trigger])

  const handleClose = useCallback(() => {
    setTitle("")
    setDescription("")
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
                Share your pattern with the community.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {isPending ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : !session?.user ? (
              <div className="grid gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Sign in with GitHub so your name appears on the pattern.
                </p>
                <Button
                  variant="outline"
                  className="justify-center"
                  nativeButton={false}
                  render={<Link href="/sign-in?callback=%2Feditor" />}
                >
                  <GithubIcon />
                  Sign in to publish
                </Button>
              </div>
            ) : (
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

                <p className="text-xs text-muted-foreground">
                  Published as <span className="font-medium text-foreground">{session.user.name}</span>.
                </p>
              </div>
            )}

            {session?.user && !isPending && (
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSubmit}
                  disabled={isMutating || title.trim().length === 0}
                >
                  {isMutating && <Spinner data-icon="inline-start" />}
                  Publish
                </AlertDialogAction>
              </AlertDialogFooter>
            )}
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

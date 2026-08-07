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
import { PatternInsertSchema } from "@/db/schema"
import { postJson } from "@/lib/utils"
import { GithubIcon } from "@/components/icon/github"
import { useSession } from "@/lib/auth/client"
import { localizedPath } from "@/i18n/config"
import { useI18n } from "@/i18n/client"

interface PublishDialogProps {
  open: boolean
  onClose: () => void
  getCellsData: () => {
    grid: string[][]; brandCode: string; brandId: string; beadStats: string
  } | null
}

export function PublishDialog({ open, onClose, getCellsData }: PublishDialogProps) {
  const { locale, t } = useI18n()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [patternId, setPatternId] = useState<string | null>(null)
  const { data: session, isPending } = useSession()
  const { trigger, isMutating } = useSWRMutation(
    "/api/patterns",
    (url, { arg }: { arg: string }) =>
      postJson<{ id: string }>(url, arg, t("editor.publishFailedTitle")),
  )

  const handleSubmit = useCallback(async () => {
    const data = getCellsData()
    if (!data) {
      toast.add({
        type: "error",
        title: t("editor.canvasEmpty"),
        description: t("editor.canvasEmptyDescription"),
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
        title: t("editor.invalidInput"),
        description: parsed.error.issues[0]?.message ?? t("editor.invalidInput"),
      })
      return
    }

    try {
      const result = await trigger(JSON.stringify(parsed.data))
      setPatternId(result.id)
    } catch (e) {
      toast.add({
        type: "error",
        title: t("editor.publishFailedTitle"),
        description: e instanceof Error ? e.message : t("editor.networkError"),
      })
    }
  }, [title, description, getCellsData, trigger, t])

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
              <AlertDialogTitle>{t("editor.publishSuccess")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("editor.publishSuccessDescription")}{" "}
                <code className="rounded bg-muted px-1 text-xs">
                  {localizedPath(locale, `/patterns/${patternId}`)}
                </code>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleClose}>{t("common.close")}</AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("editor.publishTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("editor.publishDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {isPending ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : !session?.user ? (
              <div className="grid gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  {t("auth.signInPrompt")}
                </p>
                <Button
                  variant="outline"
                  className="justify-center"
                  nativeButton={false}
                  render={
                    <Link
                      href={`${localizedPath(locale, "/sign-in")}?callback=${encodeURIComponent(
                        localizedPath(locale, "/editor"),
                      )}`}
                    />
                  }
                >
                  <GithubIcon />
                  {t("auth.signInToPublish")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="publish-title">
                    {t("editor.title")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="publish-title"
                    type="text"
                    maxLength={100}
                    placeholder={t("editor.titlePlaceholder")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="publish-description">{t("editor.description")}</Label>
                  <Textarea
                    id="publish-description"
                    maxLength={280}
                    rows={2}
                    placeholder={t("editor.descriptionPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("auth.publishedAs", { name: session.user.name })}
                </p>
              </div>
            )}

            {session?.user && !isPending && (
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSubmit}
                  disabled={isMutating || title.trim().length === 0}
                >
                  {isMutating && <Spinner data-icon="inline-start" />}
                  {t("editor.publish")}
                </AlertDialogAction>
              </AlertDialogFooter>
            )}
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

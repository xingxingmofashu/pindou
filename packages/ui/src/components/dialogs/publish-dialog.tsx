"use client"

import { useCallback, useState } from "react"
import type { z } from "zod"
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
} from "../ui/alert-dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Spinner } from "../ui/spinner"
import { toast } from "../ui/toast"
import { postJson } from "@pindou/core/utils"
import type { CellsData } from "@pindou/core/editor"
import { GithubIcon } from "../icon/github"
import { localizedPath } from "@pindou/core/i18n/config.ts"
import { useI18n } from "@pindou/core/i18n/client.tsx"

/** Minimal shape of the session the dialog reads; host apps may pass richer
 *  session types (e.g. Better Auth's) and keep their full type information. */
export interface AuthSession {
  user?: { name?: string | null } | null
}

interface PublishDialogProps<TSession extends AuthSession = AuthSession> {
  open: boolean
  onClose: () => void
  /** Called after a successful publish (e.g. to clear the editor draft). */
  onPublished?: () => void
  /** Reads the canvas grid — same contract as the API method. */
  onGetCellsData: () => CellsData | null
  /**
   * Zod schema for the publish payload — injected so the dialog stays free of
   * app/db imports (the web app passes its `PatternInsertSchema`).
   */
  insertSchema: z.ZodType
  /** Better Auth session hook — injected by the app (e.g. `useSession`). */
  useAuth: () => { data?: TSession | null; isPending?: boolean }
  /** GitHub OAuth popup — injected by the app (e.g. `signIn.popup`). */
  onSignIn: () => Promise<{ error?: unknown }>
}

export function PublishDialog<TSession extends AuthSession = AuthSession>({
  open,
  onClose,
  onPublished,
  onGetCellsData,
  insertSchema,
  useAuth,
  onSignIn,
}: PublishDialogProps<TSession>) {
  const { locale, t } = useI18n()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [patternId, setPatternId] = useState<string | null>(null)
  const { data: session, isPending } = useAuth()
  const { trigger, isMutating } = useSWRMutation(
    "/api/patterns",
    (url, { arg }: { arg: string }) =>
      postJson<{ id: string }>(url, arg, t("editor.publishFailedTitle")),
  )

  const handleSubmit = useCallback(async () => {
    const data = onGetCellsData()
    if (!data) {
      toast.add({
        type: "error",
        title: t("editor.canvasEmpty"),
        description: t("editor.canvasEmptyDescription"),
      })
      return
    }

    const parsed = insertSchema.safeParse({
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
      onPublished?.()
    } catch (e) {
      toast.add({
        type: "error",
        title: t("editor.publishFailedTitle"),
        description: e instanceof Error ? e.message : t("editor.networkError"),
      })
    }
  }, [title, description, insertSchema, onGetCellsData, trigger, t, onPublished])

  const handleClose = useCallback(() => {
    setTitle("")
    setDescription("")
    setPatternId(null)
    onClose()
  }, [onClose])

  // Runs the injected GitHub OAuth popup so the editor page never navigates
  // away and the in-memory draft survives the sign-in. On success the reactive
  // session hook updates and this dialog swaps to the publish form.
  const handleSignInPopup = useCallback(async () => {
    const { error } = await onSignIn()
    if (error) {
      toast.add({
        id: "sign-in-failed",
        type: "error",
        title: t("auth.signInFailed"),
        description: t("auth.signInFailedDescription"),
      })
    }
  }, [onSignIn, t])

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
                  onClick={handleSignInPopup}
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
                  {t("auth.publishedAs", { name: session.user.name ?? "" })}
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

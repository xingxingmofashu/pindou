"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import useSWR from "swr"
import useSWRMutation from "swr/mutation"
import { EditorPage } from "@pindou/ui/pages/editor-page"
import { UnsavedChangesGuard } from "@pindou/ui/components/unsaved-changes-guard"
import { useEditorStore } from "@pindou/core/hooks/use-editor"
import { useI18n } from "@pindou/core/i18n/client"
import { PatternInsertSchema } from "@/db/schema"
import { fetcher, postJson } from "@/lib/utils"
import { signIn, useSession } from "@/lib/auth/client"
import type { Palette } from "@pindou/shared/types"

// The publish dialog is only opened on demand — load it (and its heavy deps)
// lazily instead of blocking the editor's initial bundle.
const PublishDialog = dynamic(
  () =>
    import("@pindou/ui/components/dialogs/publish-dialog").then((m) => m.PublishDialog),
  { ssr: false },
)

/**
 * Thin web wrapper around the shared {@link EditorPage}: fetches the brand
 * catalog, wires the GitHub publish flow (PublishDialog + SWR mutation), and
 * guards against leaving with unsaved changes.
 */
export default function EditorContent() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const { data: brands = [] } = useSWR<Array<Palette>>("/api/brands", fetcher)
  const { trigger: publishTrigger } = useSWRMutation(
    "/api/patterns",
    (url, { arg }: { arg: string }) => postJson<{ id: string }>(url, arg),
  )

  const handleSignIn = useCallback(
    (callbackURL: string) =>
      signIn.popup({
        provider: "github",
        callbackURL,
      }),
    [],
  )
  const createWorker = useCallback(
    () => new Worker(new URL("../../../../../workers/transform.worker", import.meta.url)),
    [],
  )

  const dirty = useEditorStore((s) => s.beadStats !== null)

  return (
    <>
      <UnsavedChangesGuard dirty={dirty} onNavigate={(href) => router.push(href)} />
      <EditorPage
        brands={brands}
        isDark={resolvedTheme === "dark"}
        primaryLabel={t("editor.publish")}
        onPrimary={() => useEditorStore.getState().openPublish()}
        createWorker={createWorker}
      >
        <PublishDialogHost
          onSignIn={handleSignIn}
          onPublish={(payload: unknown) => publishTrigger(JSON.stringify(payload))}
        />
      </EditorPage>
    </>
  )
}

/** Publish dialog driven by the shared store's publishOpen flag. */
function PublishDialogHost({
  onSignIn,
  onPublish,
}: {
  onSignIn: (callbackURL: string) => Promise<{ error?: unknown }>
  onPublish: (payload: unknown) => Promise<{ id: string }>
}) {
  const publishOpen = useEditorStore((s) => s.publishOpen)
  const closePublish = useEditorStore((s) => s.closePublish)
  const onGetCellsData = useCallback(() => useEditorStore.getState().api?.getCellsData() ?? null, [])

  if (!publishOpen) return null
  return (
    <PublishDialog
      open={publishOpen}
      onClose={closePublish}
      onGetCellsData={onGetCellsData}
      insertSchema={PatternInsertSchema}
      useAuth={useSession}
      onSignIn={onSignIn}
      onPublish={onPublish}
    />
  )
}

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@pindou/ui/components/ui/alert-dialog"
import { Button } from "@pindou/ui/components/ui/button"
import { Input } from "@pindou/ui/components/ui/input"
import { Label } from "@pindou/ui/components/ui/label"
import { Textarea } from "@pindou/ui/components/ui/textarea"
import { useI18n } from "@pindou/core/i18n/client"

interface SaveDialogProps {
  open: boolean
  onClose: () => void
  /** Pre-fill for an existing pattern being edited. */
  initialTitle?: string
  initialDescription?: string
  /** Called with the dialog's values when the user confirms. */
  onSave: (title: string, description: string) => void
}

/** Desktop save dialog: title + description are entered here, mirroring the
 *  web publish dialog, instead of in the editor page. */
export function SaveDialog({
  open,
  onClose,
  initialTitle = "",
  initialDescription = "",
  onSave,
}: SaveDialogProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)

  // Re-seed from the pattern when the dialog opens (editing an existing one).
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose()
      return
    }
    setTitle(initialTitle)
    setDescription(initialDescription)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("desktop.save")}</AlertDialogTitle>
          <AlertDialogDescription>{t("desktop.saveDescription")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="save-title">
              {t("desktop.title")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="save-title"
              type="text"
              maxLength={200}
              placeholder={t("desktop.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="save-description">{t("desktop.description")}</Label>
            <Textarea
              id="save-description"
              maxLength={2000}
              rows={3}
              placeholder={t("desktop.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onSave(title.trim(), description.trim())}
            disabled={title.trim().length === 0}
          >
            {t("desktop.save")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

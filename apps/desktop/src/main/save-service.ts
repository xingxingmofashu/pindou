import { dialog, type BrowserWindow } from "electron"
import { writeFile } from "node:fs/promises"
import { basename } from "node:path"

/**
 * Show the system save dialog and write a PNG file. `data` arrives as a
 * structured-cloned Uint8Array over IPC, so normalize it before writing.
 *
 * @returns The written file's basename, or null when the user cancels.
 */
export async function savePngFile(
  win: BrowserWindow,
  data: Uint8Array,
  defaultName: string,
): Promise<string | null> {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: "PNG", extensions: ["png"] }],
  })
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, data)
  return basename(result.filePath)
}

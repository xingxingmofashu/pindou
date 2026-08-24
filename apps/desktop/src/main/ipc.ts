import { BrowserWindow, dialog, ipcMain } from "electron"
import { writeFile } from "node:fs/promises"
import { basename } from "node:path"
import { IPC } from "../shared/ipc"
import { store } from "./store"
import type { CreatePatternInput, UpdatePatternInput } from "../shared/types"

/** Register all ipcMain.handle handlers. Must run after app is ready. */
export function registerIpc(): void {
  ipcMain.handle(IPC.patterns.list, () => store.list())
  ipcMain.handle(IPC.patterns.get, (_e, id: string) => store.get(id))
  ipcMain.handle(IPC.patterns.create, (_e, input: CreatePatternInput) => store.create(input))
  ipcMain.handle(IPC.patterns.update, (_e, id: string, input: UpdatePatternInput) =>
    store.update(id, input),
  )
  ipcMain.handle(IPC.patterns.remove, (_e, id: string) => store.remove(id))
  ipcMain.handle(IPC.patterns.thumbnail, (_e, id: string) => store.thumbnail(id))

  ipcMain.handle(
    IPC.dialog.save,
    async (e, options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return null
      const result = await dialog.showSaveDialog(win, options)
      return result.canceled ? null : result.filePath
    },
  )

  // Desktop export: system save dialog + write the PNG bytes. `data` arrives
  // as a structured-cloned Uint8Array (a plain object with index keys after
  // the IPC round-trip), so normalize it before writing.
  ipcMain.handle(IPC.file.savePng, async (e, data: Uint8Array | ArrayBuffer, defaultName: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: "PNG", extensions: ["png"] }],
    })
    if (result.canceled || !result.filePath) return null
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer)
    await writeFile(result.filePath, bytes)
    return basename(result.filePath)
  })
}

import { BrowserWindow, dialog, ipcMain } from "electron"
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

  ipcMain.handle(
    IPC.dialog.save,
    async (e, options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const result = await dialog.showSaveDialog(win!, options)
      return result.canceled ? null : result.filePath
    },
  )
}

import { BrowserWindow, ipcMain } from "electron"
import { IPC } from "../shared/ipc"
import { store } from "./store"
import { savePngFile } from "./save-service"
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

  ipcMain.handle(IPC.file.savePng, async (e, data: Uint8Array, defaultName: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    return savePngFile(win, data, defaultName)
  })

  // Frameless-window controls, driven from the custom title bar.
  ipcMain.on(IPC.window.minimize, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on(IPC.window.toggleMaximize, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on(IPC.window.close, (e) => BrowserWindow.fromWebContents(e.sender)?.close())
}

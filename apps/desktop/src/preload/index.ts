import { contextBridge, ipcRenderer } from "electron"
import { IPC } from "../shared/ipc"
import type { PindouApi } from "../shared/types"

const api: PindouApi = {
  patterns: {
    list: () => ipcRenderer.invoke(IPC.patterns.list),
    get: (id: string) => ipcRenderer.invoke(IPC.patterns.get, id),
    create: (input) => ipcRenderer.invoke(IPC.patterns.create, input),
    update: (id, input) => ipcRenderer.invoke(IPC.patterns.update, id, input),
    remove: (id: string) => ipcRenderer.invoke(IPC.patterns.remove, id),
    thumbnail: (id: string) => ipcRenderer.invoke(IPC.patterns.thumbnail, id),
  },
  savePng: (data, defaultName) => ipcRenderer.invoke(IPC.file.savePng, data, defaultName),
  window: {
    minimize: () => ipcRenderer.send(IPC.window.minimize),
    toggleMaximize: () => ipcRenderer.send(IPC.window.toggleMaximize),
    close: () => ipcRenderer.send(IPC.window.close),
    onMaximized: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized)
      ipcRenderer.on(IPC.window.maximized, listener)
      return () => ipcRenderer.removeListener(IPC.window.maximized, listener)
    },
  },
}

contextBridge.exposeInMainWorld("pindou", api)

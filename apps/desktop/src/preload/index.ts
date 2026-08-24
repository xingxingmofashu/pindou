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
  saveDialog: (options) => ipcRenderer.invoke(IPC.dialog.save, options),
  savePng: (data, defaultName) => ipcRenderer.invoke(IPC.file.savePng, data, defaultName),
}

contextBridge.exposeInMainWorld("pindou", api)

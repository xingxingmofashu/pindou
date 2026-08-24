import { app, BrowserWindow, shell } from "electron"
import { join } from "node:path"
import { registerIpc } from "./ipc"
import { initDb } from "../db"

// WebGL needs a GPU or SwiftShader fallback. Chromium now blocks the software
// rasterizer by default, so without this switch PixiJS's canvas init throws
// ("WebGL unavailable") on machines without hardware acceleration — e.g.
// VMs, remote desktops, and some older Macs.
app.commandLine.appendSwitch("enable-unsafe-swiftshader")

// Single instance: the SQLite store is a local file, so a second window would
// race writes against the first. Focus the existing window instead.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 620,
    title: "Pindou",
    backgroundColor: "#fafafa",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Open external links in the system browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  // electron-vite: dev server URL in dev, built file in prod.
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

app.whenReady().then(() => {
  initDb()
  registerIpc()
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

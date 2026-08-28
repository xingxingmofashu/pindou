import { app, BrowserWindow, shell } from "electron"
import squirrelStartup from 'electron-squirrel-startup'
import { join } from "node:path"
import { registerIpc } from "./ipc"
import { initDb } from "./db"
import { setupAutoUpdate } from "./auto-update"
import { IPC } from "../shared/ipc"

// Squirrel.Windows spawns the app with special args on install/update/
// uninstall. Handle them first and quit, otherwise Updater.exe hangs waiting
// for the app to exit.
if (squirrelStartup) {
  app.quit()
}

// Windows taskbar grouping + notifications (Squirrel requires this).
app.setAppUserModelId("com.pindou.desktop")

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

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 940,
    minHeight: 620,
    title: "Pindou",
    backgroundColor: "#fafafa",
    // Frameless: the header provides the drag region and window controls.
    frame: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
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

  // Keep the renderer's maximize button in sync with the window state.
  const sendMaximized = () =>
    win.webContents.send(IPC.window.maximized, win.isMaximized())
  win.on("maximize", sendMaximized)
  win.on("unmaximize", sendMaximized)

  // Electron Forge plugin-vite: `MAIN_WINDOW_VITE_DEV_SERVER_URL` is a
  // compile-time define (injected by the plugin), not a process env var.
  // Main bundle lives in .vite/build, renderer in .vite/renderer/main_window.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(__dirname, "../renderer/main_window/index.html"))
  }
  return win
}

app.whenReady().then(() => {
  initDb()
  registerIpc()
  const win = createWindow()

  // Ask the user before downloading a new release (packaged builds only).
  if (app.isPackaged) {
    setupAutoUpdate(win)
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

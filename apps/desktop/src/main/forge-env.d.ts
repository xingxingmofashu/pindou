/// <reference types="vite/client" />

// Electron Forge plugin-vite injects these as compile-time defines for the
// main + preload bundles. See @electron-forge/plugin-vite's vite.base.config.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

declare module "electron-squirrel-startup" {
  const squirrelStartup: boolean
  export default squirrelStartup
}

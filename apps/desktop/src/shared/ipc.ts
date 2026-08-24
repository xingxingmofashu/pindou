/** IPC channel names shared between main, preload, and renderer. */
export const IPC = {
  patterns: {
    list: "patterns:list",
    get: "patterns:get",
    create: "patterns:create",
    update: "patterns:update",
    remove: "patterns:remove",
    thumbnail: "patterns:thumbnail",
  },
  window: {
    minimize: "window:minimize",
    toggleMaximize: "window:toggleMaximize",
    close: "window:close",
    /** main → renderer: the window's maximized state changed. */
    maximized: "window:maximized",
  },
  file: {
    savePng: "file:savePng",
  },
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC][keyof (typeof IPC)[keyof typeof IPC]]

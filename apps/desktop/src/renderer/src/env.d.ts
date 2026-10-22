/// <reference types="vite/client" />

import type { PindouApi } from "../../shared/ipc"

declare global {
  interface Window {
    pindou: PindouApi
  }
}

export {}

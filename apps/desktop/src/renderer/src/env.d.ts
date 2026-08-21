/// <reference types="vite/client" />

import type { PindouApi } from "../../shared/types"

declare global {
  interface Window {
    pindou: PindouApi
  }
}

export {}

import type { BeadPalette } from "@/types/palette"

import { MARD_PALETTE } from "./brand/mard"
import { PERLER_PALETTE } from "./brand/perler"
import { ARTKAL_PALETTE } from './brand/artkal'
import { HAMA_PALETTE } from './brand/hama'

export const DEFAULT_PALETTE_ID = "mard"

export const PALETTES: ReadonlyMap<string, BeadPalette> = new Map([
  [MARD_PALETTE.id, MARD_PALETTE],
  [PERLER_PALETTE.id, PERLER_PALETTE],
  [ARTKAL_PALETTE.id, ARTKAL_PALETTE],
  [HAMA_PALETTE.id, HAMA_PALETTE]
])
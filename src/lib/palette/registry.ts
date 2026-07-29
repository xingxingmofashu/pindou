import type { BeadColor, BeadPalette } from "@/types/palette"

import { MARD_PALETTE } from "./brand/mard"
import { PERLER_PALETTE } from "./brand/perler"

export const DEFAULT_PALETTE_ID = "mard"

export const PALETTES: ReadonlyMap<string, BeadPalette> = new Map([
  [MARD_PALETTE.id, MARD_PALETTE],
  [PERLER_PALETTE.id, PERLER_PALETTE],
])
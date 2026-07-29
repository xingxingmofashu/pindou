export interface BeadColor {
  id:string
  /** Brand color code, e.g. "A1" */
  code: string
  /** color name */
  name: string
  /** Display hex color, e.g. "#E63946" */
  hex: string
  /** Series letter, e.g. "A" */
  series?: string
}

export interface BeadPalette {
  /** Palette identifier, e.g. "mard" */
  id: string
  /** Brand display name, e.g. "MARD/漫漫" */
  brand: string
  colors: BeadColor[]
}

/** Colour conversions for renderer APIs that take packed integers. */
export class HexColor {
  /**
   * Convert a `#rrggbb` string to the packed `0xRRGGBB` integer PixiJS and the
   * thumbnail writers expect.
   *
   * @param hex - The hex string (with or without the leading `#`).
   * @returns The packed RGB integer.
   */
  static toInt(hex: string): number {
    return parseInt(hex.replace("#", ""), 16)
  }
}

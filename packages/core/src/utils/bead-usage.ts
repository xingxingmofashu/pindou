import { Json } from "./json"

/** Helpers for the stored bead-usage shape (`{ "A1": 12 }`). */
export class BeadUsage {
  /**
   * Parse a stored bead-usage JSON string.
   *
   * @param raw - The JSON string (`""` or malformed input yields `{}`).
   * @returns Colour code → bead count.
   */
  static parse(raw: string): Record<string, number> {
    return Json.parse(raw, {})
  }

  /**
   * Sum every count in a bead-usage record.
   *
   * @param stats - Colour code → bead count.
   * @returns The total number of beads.
   */
  static total(stats: Record<string, number>): number {
    let sum = 0
    for (const value of Object.values(stats)) sum += value
    return sum
  }
}

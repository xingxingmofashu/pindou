/**
 * Frequency-map helpers used by the eyedropper, the bead renderer, and the
 * image importer.
 */
export class MostFrequent {
  /**
   * Return the key with the highest count in a frequency map.
   *
   * Ties keep the first key in iteration order (the comparison is strictly
   * greater), and a key with a count of zero is never returned.
   *
   * @param counts - Map from key to occurrence count.
   * @param skip   - Optional predicate for keys to ignore (e.g. `EMPTY`).
   * @returns The most frequent key, or `undefined` when the map is empty (or
   *          every entry is skipped).
   */
  static of<K>(counts: Map<K, number>, skip?: (key: K) => boolean): K | undefined {
    let best: K | undefined
    let bestN = 0
    for (const [key, n] of counts) {
      if (skip?.(key)) continue
      if (n > bestN) {
        bestN = n
        best = key
      }
    }
    return best
  }
}

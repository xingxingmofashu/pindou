/** Grouping helpers for palette colours. */
export class ColorSeries {
  /**
   * Group items by the series key each item maps to, preserving first-seen
   * order. Callers pass a `seriesOf` mapper (e.g. `(c) => c.series ?? "?"`).
   *
   * @param items    - The items to group.
   * @param seriesOf - Maps an item to its series key.
   * @returns The groups in first-seen order.
   */
  static group<T>(items: T[], seriesOf: (item: T) => string): { series: string; colors: T[] }[] {
    const groups: { series: string; colors: T[] }[] = []
    const bySeries = new Map<string, { series: string; colors: T[] }>()
    for (const item of items) {
      const series = seriesOf(item)
      let group = bySeries.get(series)
      if (!group) {
        group = { series, colors: [] }
        bySeries.set(series, group)
        groups.push(group)
      }
      group.colors.push(item)
    }
    return groups
  }
}

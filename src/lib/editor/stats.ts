/** 扫描 grid 计算每色用量 → Map<colorId, count> */
export function computeBeadStats(cells: Array<string | null>): Map<string, number> {
  const stats = new Map<string, number>()
  for (const id of cells) {
    if (id !== null) {
      stats.set(id, (stats.get(id) ?? 0) + 1)
    }
  }
  return stats
}

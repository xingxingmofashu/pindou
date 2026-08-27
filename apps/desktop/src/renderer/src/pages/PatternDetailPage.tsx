import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PatternDetailPage } from "@pindou/ui/pages/pattern-detail-page"
import { PALETTES } from "@pindou/shared/palettes"
import type { PatternRecord } from "../../../shared/types"

/**
 * Desktop read-only pattern viewer — thin wrapper around the shared
 * {@link PatternDetailPage}: loads the record from local SQLite and wires
 * react-router navigation + the IPC save target for exports.
 */
export default function PatternDetailPageWrapper() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const [pattern, setPattern] = useState<PatternRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    window.pindou.patterns.get(id).then((record) => {
      if (!cancelled) setPattern(record ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!pattern) {
    return null
  }

  const palette = PALETTES.find((b) => b.id === pattern.fkBrandId)
  if (!palette) return null

  return (
    <PatternDetailPage
      id={id}
      title={pattern.title}
      description={pattern.description}
      grid={pattern.grid}
      palette={palette}
      beadStats={pattern.beadStats}
      canEdit
      createdAt={pattern.createdAt}
      updatedAt={pattern.updatedAt}
      onBack={() => navigate("/patterns")}
      onEdit={() => navigate(`/editor/${pattern.id}`)}
      onExport={async (blob, defaultName) => {
        await window.pindou.savePng(new Uint8Array(await blob.arrayBuffer()), defaultName)
      }}
    />
  )
}

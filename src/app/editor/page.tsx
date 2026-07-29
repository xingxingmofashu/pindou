"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { useEditor } from "@/hooks/use-editor"
import { BeadCanvas } from "@/components/bead-canvas"
import { ColorPicker } from "@/components/color-picker"
import { ToolBar } from "@/components/tool-bar"
import { ZoomControls } from "@/components/zoom-controls"
import { StatsBar } from "@/components/stats-bar"

export default function EditorPage() {
  const {
    canvasRef,
    state,
    palette,
    setColor,
    setTool,
    undo,
    redo,
    setZoom,
    toggleGrid,
    toggleLabels,
    clear,
  } = useEditor()

  const totalBeads = [...state.beadStats.values()].reduce((s, c) => s + c, 0)

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <ToolBar activeTool={state.activeTool} onSelectTool={setTool} />
          <div className="flex items-center gap-2">
            <ZoomControls zoom={state.zoom} onSetZoom={setZoom} />
          </div>
        </div>

        {/* 主体：色号面板 + 画布 */}
        <div className="flex flex-1 gap-2 px-3 pb-2">
          <aside className="w-48 shrink-0 overflow-auto rounded-lg border border-border p-1">
            <ColorPicker
              palette={palette}
              activeColorId={state.activeColorId}
              beadStats={state.beadStats}
              onSelectColor={setColor}
            />
          </aside>
          <BeadCanvas canvasRef={canvasRef} width={state.width} height={state.height} />
        </div>

        {/* 底部状态栏 */}
        <div className="px-3 py-2 border-t">
          <StatsBar
            totalBeads={totalBeads}
            colorKindCount={state.beadStats.size}
            showGridLines={state.showGridLines}
            showBeadNumbers={state.showBeadNumbers}
            canUndo={state.undoStack.length > 0}
            canRedo={state.redoStack.length > 0}
            onUndo={undo}
            onRedo={redo}
            onToggleGrid={toggleGrid}
            onToggleLabels={toggleLabels}
            onClear={clear}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}

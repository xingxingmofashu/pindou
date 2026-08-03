interface PatternDetailToolbarProps {
  title: string
}

export function PatternDetailToolbar({ title }: PatternDetailToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border">
      <h1 className="text-sm font-semibold tracking-tight truncate">{title}</h1>
    </div>
  )
}

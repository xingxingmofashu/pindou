import { Skeleton } from "@pindou/ui/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="w-56 shrink-0 flex flex-col gap-4 border p-3">
          <Skeleton className="h-5 w-3/4" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="flex-1 min-w-0 rounded-none border" />
      </div>
    </div>
  )
}

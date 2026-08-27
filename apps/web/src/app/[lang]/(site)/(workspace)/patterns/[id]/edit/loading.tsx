import { Skeleton } from "@pindou/ui/components/ui/skeleton"
import { RouteProgress } from "@/components/route-progress"

export default function Loading() {
  return (
    <>
      <RouteProgress />
      <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="w-56 shrink-0 flex flex-col gap-3">
          <div className="space-y-1.5 border p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="flex-1 min-h-0">
            <Skeleton className="h-full w-full rounded-none border" />
          </div>
        </div>
        <Skeleton className="flex-1 min-w-0 rounded-none border" />
      </div>
    </div>
    </>
  )
}

import { Skeleton } from "@pindou/ui/components/ui/skeleton"
import { RouteProgress } from "@/components/route-progress"

export default function Loading() {
  return (
    <>
      <RouteProgress />
      <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="w-56 shrink-0 min-h-0 flex flex-col gap-3 border">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] content-start gap-2 px-2 py-2">
            {Array.from({ length: 24 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-sm" />
            ))}
          </div>
        </div>
        <Skeleton className="flex-1 min-w-0 rounded-none border" />
      </div>
    </div>
    </>
  )
}

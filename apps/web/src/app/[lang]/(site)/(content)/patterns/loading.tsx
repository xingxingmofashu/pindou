import { Card, CardHeader } from "@pindou/ui/components/ui/card"
import { Skeleton } from "@pindou/ui/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card className="pt-0" key={i}>
          <Skeleton className="aspect-square w-full rounded-none" />
          <CardHeader>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

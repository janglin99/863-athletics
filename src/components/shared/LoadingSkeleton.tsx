import { Skeleton } from "@/components/ui/skeleton"

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-64 bg-bg-elevated" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 bg-bg-elevated rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 bg-bg-elevated rounded-lg" />
    </div>
  )
}

export function CardSkeleton() {
  return <Skeleton className="h-40 w-full bg-bg-elevated rounded-lg" />
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full bg-bg-elevated rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full bg-bg-elevated rounded" />
      ))}
    </div>
  )
}

import { Skeleton } from "../Skeleton";

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading email" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="card space-y-3 px-4 py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

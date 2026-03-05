import { StatsCardSkeleton, Skeleton } from '@/components/UI/LoadingStates';

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />

      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Row 2: Revenue metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Row 3: Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
            <div className="px-6 py-4 border-b border-gray-100">
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between px-6 py-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Row 4: Face Processing Queue */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
        <div className="px-6 py-4 border-b border-gray-100">
          <Skeleton className="h-3 w-40 rounded" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-2.5 rounded-full" />
        </div>
      </div>
    </div>
  );
}

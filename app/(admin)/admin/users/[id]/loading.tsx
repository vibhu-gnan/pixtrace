import { Skeleton } from '@/components/UI/LoadingStates';

export default function AdminUserDetailLoading() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      {/* Back link */}
      <Skeleton className="h-4 w-28 rounded" />

      {/* User profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="h-4 w-52 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 rounded mb-2" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Events table skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex gap-6">
              {Array.from({ length: 5 }).map((_, c) => (
                <Skeleton key={c} className="h-4 flex-1 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Subscriptions skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <div className="p-8 flex justify-center">
          <Skeleton className="h-4 w-28 rounded" />
        </div>
      </div>
    </div>
  );
}

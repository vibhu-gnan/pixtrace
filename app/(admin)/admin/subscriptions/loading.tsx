import { TableSkeleton, Skeleton } from '@/components/UI/LoadingStates';

export default function AdminSubscriptionsLoading() {
  return (
    <div className="space-y-8">
      {/* Subscriptions Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-36 bg-gray-200 rounded animate-pulse" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>

        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>

        <TableSkeleton rows={5} columns={5} />
      </div>

      {/* Payments Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-7 w-36 bg-gray-200 rounded animate-pulse" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>

        <TableSkeleton rows={5} columns={6} />
      </div>
    </div>
  );
}

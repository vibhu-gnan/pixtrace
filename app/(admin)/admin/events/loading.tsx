import { TableSkeleton, Skeleton } from '@/components/UI/LoadingStates';

export default function AdminEventsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
        <Skeleton className="h-6 w-10 rounded-full" />
      </div>

      <Skeleton className="h-10 w-full max-w-sm rounded-lg" />

      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}

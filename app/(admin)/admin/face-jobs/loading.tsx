import { TableSkeleton, Skeleton } from '@/components/UI/LoadingStates';

export default function AdminFaceJobsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-52 bg-gray-200 rounded animate-pulse" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>

      <TableSkeleton rows={8} columns={7} />
    </div>
  );
}

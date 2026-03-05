import { TableSkeleton, Skeleton } from '@/components/UI/LoadingStates';

export default function AdminInquiriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Skeleton className="h-6 w-10 rounded-full" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>

      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}

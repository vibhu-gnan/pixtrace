import { TableSkeleton, Skeleton } from '@/components/UI/LoadingStates';

export default function AdminUsersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
        <Skeleton className="h-6 w-10 rounded-full" />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-lg" />
          ))}
        </div>
      </div>

      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

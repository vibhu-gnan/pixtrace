import { Skeleton } from '@/components/UI/LoadingStates';

export default function SettingsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-8 w-28 rounded" />
        <Skeleton className="h-4 w-14 rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Gallery Cover */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-28 rounded" />
                <Skeleton className="h-4 w-64 rounded" />
              </div>
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>

          {/* Logo Settings */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-4 w-56 rounded" />
            <div className="flex items-start gap-6">
              <Skeleton className="w-32 h-32 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>

          {/* Event Details */}
          <div className="space-y-6">
            <Skeleton className="h-5 w-28 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20 rounded mb-2" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <Skeleton className="h-5 w-24 rounded mb-4" />
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

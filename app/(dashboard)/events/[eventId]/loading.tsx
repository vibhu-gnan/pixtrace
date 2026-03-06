export default function EventLoading() {
  return (
    <div className="skeleton-enter space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded skeleton-shimmer" />
          <div className="h-4 w-32 rounded skeleton-shimmer" />
        </div>
        <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="h-4 w-20 rounded skeleton-shimmer" />
            <div className="h-7 w-12 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-square rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

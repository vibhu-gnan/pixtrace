export default function DashboardLoading() {
  return (
    <div className="animate-page-in">
      {/* Filter bar skeleton */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-full skeleton-shimmer" />
          <div className="h-9 w-20 rounded-full skeleton-shimmer" />
          <div className="h-9 w-20 rounded-full skeleton-shimmer" />
        </div>
        <div className="h-8 w-32 rounded-lg skeleton-shimmer" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="h-40 skeleton-shimmer" />
            <div className="p-5 space-y-3">
              <div className="h-5 w-3/4 rounded skeleton-shimmer" />
              <div className="h-4 w-1/2 rounded skeleton-shimmer" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-16 rounded-full skeleton-shimmer" />
                <div className="h-6 w-20 rounded-full skeleton-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

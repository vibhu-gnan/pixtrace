export default function FaceJobsLoading() {
  return (
    <div className="animate-page-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded skeleton-shimmer" />
        <div className="h-9 w-32 rounded-lg skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
            <div className="w-2.5 h-2.5 rounded-full skeleton-shimmer" />
            <div className="h-4 w-16 rounded skeleton-shimmer" />
            <div className="h-4 w-8 rounded skeleton-shimmer ml-auto" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div className="space-y-1">
              <div className="h-4 w-48 rounded skeleton-shimmer" />
              <div className="h-3 w-32 rounded skeleton-shimmer" />
            </div>
            <div className="h-5 w-20 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

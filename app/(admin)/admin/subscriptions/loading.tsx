export default function SubscriptionsLoading() {
  return (
    <div className="skeleton-enter space-y-6">
      <div className="h-7 w-36 rounded skeleton-shimmer" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <div className="h-4 w-24 rounded skeleton-shimmer" />
            <div className="h-8 w-12 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div className="space-y-1">
              <div className="h-4 w-36 rounded skeleton-shimmer" />
              <div className="h-3 w-48 rounded skeleton-shimmer" />
            </div>
            <div className="h-5 w-20 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

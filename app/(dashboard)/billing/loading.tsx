export default function BillingLoading() {
  return (
    <div className="skeleton-enter space-y-6 max-w-4xl">
      <div className="h-7 w-28 rounded skeleton-shimmer" />

      {/* Current plan card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 rounded skeleton-shimmer" />
            <div className="h-4 w-48 rounded skeleton-shimmer" />
          </div>
          <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="h-5 w-20 rounded skeleton-shimmer" />
            <div className="h-8 w-24 rounded skeleton-shimmer" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-3 w-full rounded skeleton-shimmer" />
              ))}
            </div>
            <div className="h-10 w-full rounded-lg skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminLoading() {
  return (
    <div className="skeleton-enter space-y-6">
      <div className="h-7 w-44 rounded skeleton-shimmer" />

      {/* Stats row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <div className="h-4 w-24 rounded skeleton-shimmer" />
            <div className="h-8 w-16 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Stats row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <div className="h-4 w-32 rounded skeleton-shimmer" />
            <div className="h-8 w-20 rounded skeleton-shimmer" />
            <div className="h-3 w-40 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((col) => (
          <div key={col} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="h-4 w-32 rounded skeleton-shimmer" />
            </div>
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="flex items-center justify-between px-6 py-3">
                  <div className="space-y-1">
                    <div className="h-4 w-36 rounded skeleton-shimmer" />
                    <div className="h-3 w-24 rounded skeleton-shimmer" />
                  </div>
                  <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

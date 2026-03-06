export default function DesignLoading() {
  return (
    <div className="skeleton-enter space-y-6">
      <div className="h-7 w-36 rounded skeleton-shimmer" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme options */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="h-5 w-32 rounded skeleton-shimmer" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-lg skeleton-shimmer" />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="h-5 w-24 rounded skeleton-shimmer" />
          <div className="h-64 rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

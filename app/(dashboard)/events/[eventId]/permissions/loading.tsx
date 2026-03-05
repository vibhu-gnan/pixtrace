export default function PermissionsLoading() {
  return (
    <div className="animate-page-in space-y-6 max-w-2xl">
      <div className="h-7 w-36 rounded skeleton-shimmer" />

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div className="space-y-1">
              <div className="h-4 w-40 rounded skeleton-shimmer" />
              <div className="h-3 w-24 rounded skeleton-shimmer" />
            </div>
            <div className="h-8 w-20 rounded-lg skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

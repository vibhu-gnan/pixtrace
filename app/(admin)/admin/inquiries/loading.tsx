export default function InquiriesLoading() {
  return (
    <div className="skeleton-enter space-y-6">
      <div className="h-7 w-28 rounded skeleton-shimmer" />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-6 py-4 border-b border-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 rounded skeleton-shimmer" />
              <div className="h-5 w-16 rounded-full skeleton-shimmer" />
            </div>
            <div className="h-3 w-64 rounded skeleton-shimmer" />
            <div className="h-3 w-48 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

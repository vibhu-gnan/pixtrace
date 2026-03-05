export default function AdminEventsLoading() {
  return (
    <div className="animate-page-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded skeleton-shimmer" />
        <div className="h-9 w-48 rounded-lg skeleton-shimmer" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50">
          {['w-32', 'w-24', 'w-16', 'w-20', 'w-20'].map((w, i) => (
            <div key={i} className={`h-3 ${w} rounded skeleton-shimmer`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-gray-50">
            <div className="h-4 w-40 rounded skeleton-shimmer" />
            <div className="h-4 w-28 rounded skeleton-shimmer" />
            <div className="h-5 w-16 rounded-full skeleton-shimmer" />
            <div className="h-4 w-12 rounded skeleton-shimmer" />
            <div className="h-4 w-20 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

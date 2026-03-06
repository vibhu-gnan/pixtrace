export default function UserDetailLoading() {
  return (
    <div className="skeleton-enter space-y-6 max-w-4xl">
      {/* Back link */}
      <div className="h-4 w-20 rounded skeleton-shimmer" />

      {/* User header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full skeleton-shimmer" />
          <div className="space-y-2">
            <div className="h-6 w-40 rounded skeleton-shimmer" />
            <div className="h-4 w-52 rounded skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="h-5 w-28 rounded skeleton-shimmer" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex justify-between py-2">
                <div className="h-4 w-24 rounded skeleton-shimmer" />
                <div className="h-4 w-32 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

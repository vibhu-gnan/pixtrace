export default function SettingsLoading() {
  return (
    <div className="skeleton-enter space-y-6 max-w-2xl">
      <div className="h-7 w-32 rounded skeleton-shimmer" />

      {/* Form sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="h-5 w-40 rounded skeleton-shimmer" />
          <div className="space-y-3">
            <div className="h-4 w-24 rounded skeleton-shimmer" />
            <div className="h-10 w-full rounded-lg skeleton-shimmer" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-28 rounded skeleton-shimmer" />
            <div className="h-10 w-full rounded-lg skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

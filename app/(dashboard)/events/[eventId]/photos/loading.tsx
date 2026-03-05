export default function PhotosLoading() {
  return (
    <div className="animate-page-in space-y-6">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-32 rounded-lg skeleton-shimmer" />
          <div className="h-9 w-24 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
      </div>

      {/* Photo grid skeleton */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

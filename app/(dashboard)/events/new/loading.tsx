export default function NewEventLoading() {
  return (
    <div className="animate-page-in max-w-2xl mx-auto space-y-6">
      <div className="h-7 w-40 rounded skeleton-shimmer" />

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-28 rounded skeleton-shimmer" />
            <div className="h-10 w-full rounded-lg skeleton-shimmer" />
          </div>
        ))}
        <div className="h-10 w-full rounded-lg skeleton-shimmer mt-4" />
      </div>
    </div>
  );
}

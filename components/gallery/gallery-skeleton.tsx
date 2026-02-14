export function GallerySkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-200 w-full" style={{ aspectRatio: i % 2 === 0 ? '3/4' : '4/3' }} />
            ))}
        </div>
    );
}

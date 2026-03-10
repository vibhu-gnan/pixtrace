export default function PreviewLoading() {
    return (
        <div className="fixed inset-0 bg-gray-950 flex flex-col z-50">
            {/* Toolbar skeleton */}
            <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="flex gap-1">
                    <div className="h-8 w-20 bg-gray-100 rounded-md animate-pulse" />
                    <div className="h-8 w-20 bg-gray-100 rounded-md animate-pulse" />
                </div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Device frame skeleton */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="flex flex-col items-center w-[90%] max-w-[900px]">
                    {/* Screen bezel */}
                    <div className="relative w-full bg-[#1a1a1a] rounded-t-xl pt-6 pb-4 px-5">
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#2a2a2a]" />
                        <div className="w-full aspect-[16/10] rounded-md bg-gray-900 animate-pulse" />
                    </div>
                    <div className="w-[calc(100%+16px)] h-3.5 bg-gradient-to-b from-[#2a2a2a] to-[#1f1f1f] rounded-b" />
                    <div className="w-[20%] h-1 bg-[#333] rounded-b-sm" />
                </div>
            </div>
        </div>
    );
}

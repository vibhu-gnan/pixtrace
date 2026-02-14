'use client';

import { useState, useEffect, useMemo } from 'react';
import { PhotoLightbox } from '@/components/event/photo-lightbox';
import type { GalleryMediaItem } from '@/actions/gallery';
import type { MediaItem } from '@/actions/media';

// ─── Gallery Grid (Masonry) ───────────────────────────────────

interface GalleryGridProps {
    media: GalleryMediaItem[];
    albumFilter: string | null;
}

export function GalleryGrid({ media, albumFilter }: GalleryGridProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [columns, setColumns] = useState(4);

    // Register service worker for image caching
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { });
        }
    }, []);

    // Responsive column count
    useEffect(() => {
        function updateColumns() {
            const w = window.innerWidth;
            if (w < 640) setColumns(2);
            else if (w < 768) setColumns(3);
            else setColumns(4);
        }
        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    const filtered = albumFilter
        ? media.filter((m) => m.album_id === albumFilter)
        : media;

    const images = filtered.filter((m) => m.media_type === 'image');

    // Build index map for lightbox (must be above early return to satisfy hooks rules)
    const indexMap = useMemo(() => {
        const map = new Map<string, number>();
        images.forEach((img, i) => map.set(img.id, i));
        return map;
    }, [images]);

    // Convert to MediaItem format for the lightbox
    const lightboxMedia: MediaItem[] = useMemo(() => images.map((img) => ({
        id: img.id,
        album_id: img.album_id,
        event_id: '',
        r2_key: '',
        original_filename: img.original_filename,
        media_type: img.media_type,
        mime_type: null,
        file_size: 0,
        width: img.width,
        height: img.height,
        processing_status: 'completed',
        created_at: '',
        thumbnail_url: img.thumbnail_url,
        blur_url: img.blur_url,
        full_url: img.full_url,
        original_url: img.original_url,
    })), [images]);

    if (images.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-1">No photos yet</h3>
                <p className="text-sm text-gray-400">Photos will appear here once they are uploaded.</p>
            </div>
        );
    }

    // Distribute images into columns for masonry layout
    const columnArrays: GalleryMediaItem[][] = Array.from({ length: columns }, () => []);
    const columnHeights = new Array(columns).fill(0);

    images.forEach((img) => {
        const minIdx = columnHeights.indexOf(Math.min(...columnHeights));
        columnArrays[minIdx].push(img);
        const w = img.width || 3;
        const h = img.height || 4;
        columnHeights[minIdx] += h / w;
    });

    function openLightbox(imageId: string) {
        const idx = indexMap.get(imageId);
        if (idx !== undefined) {
            setLightboxIndex(idx);
            setLightboxOpen(true);
        }
    }

    return (
        <>
            {/* Masonry grid */}
            <div className="flex gap-1" style={{ alignItems: 'flex-start' }}>
                {columnArrays.map((col, colIdx) => (
                    <div key={colIdx} className="flex-1 flex flex-col gap-1">
                        {col.map((item) => (
                            <MasonryThumbnail
                                key={item.id}
                                item={item}
                                onClick={() => openLightbox(item.id)}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {lightboxOpen && (
                <PhotoLightbox
                    media={lightboxMedia}
                    initialIndex={lightboxIndex}
                    isOpen={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </>
    );
}

// ─── Masonry Thumbnail ───────────────────────────────────────

function MasonryThumbnail({
    item,
    onClick,
}: {
    item: GalleryMediaItem;
    onClick: () => void;
}) {
    const [loaded, setLoaded] = useState(false);
    const [imgSrc, setImgSrc] = useState(item.full_url || item.thumbnail_url || item.original_url);

    const handleImageError = () => {
        if (imgSrc === item.full_url && item.thumbnail_url) {
            setImgSrc(item.thumbnail_url);
        } else if (imgSrc !== item.original_url) {
            setImgSrc(item.original_url);
        }
    };

    // Natural aspect ratio from metadata (fallback to 4:3)
    const w = item.width || 4;
    const h = item.height || 3;
    const aspect = `${w} / ${h}`;

    return (
        <div
            className="relative overflow-hidden bg-gray-100 group cursor-pointer"
            style={{
                aspectRatio: aspect,
                ...(item.blur_url
                    ? { backgroundImage: `url(${item.blur_url})`, backgroundSize: 'cover' }
                    : {}),
            }}
            onClick={onClick}
        >
            <img
                src={imgSrc}
                alt={item.original_filename}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={handleImageError}
                className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { PhotoLightbox } from '@/components/event/photo-lightbox';
import type { GalleryMediaItem } from '@/actions/gallery';
import type { MediaItem } from '@/actions/media';

// ─── Gallery Grid ────────────────────────────────────────────

interface GalleryGridProps {
    media: GalleryMediaItem[];
    albumFilter: string | null;
}

export function GalleryGrid({ media, albumFilter }: GalleryGridProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Register service worker for image caching
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { });
        }
    }, []);

    const filtered = albumFilter
        ? media.filter((m) => m.album_id === albumFilter)
        : media;

    const images = filtered.filter((m) => m.media_type === 'image');

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

    // Convert to MediaItem format for the lightbox (which expects MediaItem[])
    const lightboxMedia: MediaItem[] = images.map((img) => ({
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
    }));

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                {images.map((item, index) => (
                    <GalleryThumbnail
                        key={item.id}
                        item={item}
                        onClick={() => {
                            setLightboxIndex(index);
                            setLightboxOpen(true);
                        }}
                    />
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

// ─── Gallery Thumbnail ───────────────────────────────────────

function GalleryThumbnail({
    item,
    onClick,
}: {
    item: GalleryMediaItem;
    onClick: () => void;
}) {
    const [loaded, setLoaded] = useState(false);
    // Fallback chain: preview → thumbnail → original
    const [imgSrc, setImgSrc] = useState(item.full_url || item.thumbnail_url || item.original_url);

    const handleImageError = () => {
        if (imgSrc === item.full_url && item.thumbnail_url) {
            setImgSrc(item.thumbnail_url);
        } else if (imgSrc !== item.original_url) {
            setImgSrc(item.original_url);
        }
    };

    return (
        <div
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group cursor-pointer"
            style={
                item.blur_url
                    ? { backgroundImage: `url(${item.blur_url})`, backgroundSize: 'cover' }
                    : undefined
            }
            onClick={onClick}
        >
            <img
                src={imgSrc}
                alt={item.original_filename}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={handleImageError}
                className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'
                    }`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
    );
}

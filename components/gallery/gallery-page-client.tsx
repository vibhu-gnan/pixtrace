'use client';

import { useState, useEffect } from 'react';
import { GalleryGrid } from './gallery-grid';
import type { GalleryMediaItem } from '@/actions/gallery';

interface GalleryPageClientProps {
    media: GalleryMediaItem[];
    albums: { id: string; name: string }[];
    eventHash: string;
}

export function GalleryPageClient({ media, albums, eventHash }: GalleryPageClientProps) {
    const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
    const [revoked, setRevoked] = useState(false);

    // Heartbeat: check every 30s if the gallery is still public
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/gallery/check?hash=${eventHash}`);
                const data = await res.json();
                if (!data.public) {
                    setRevoked(true);
                    clearInterval(interval);
                }
            } catch {
                // Network error — don't revoke, just skip this check
            }
        }, 30_000);

        return () => clearInterval(interval);
    }, [eventHash]);

    // Revoked overlay — gallery is no longer public
    if (revoked) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Gallery No Longer Available</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                    The organizer has made this gallery private. Contact them for access.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Album filter tabs (only show if multiple albums) */}
            {albums.length > 1 && (
                <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
                    <button
                        onClick={() => setActiveAlbum(null)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${activeAlbum === null
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        All Photos
                    </button>
                    {albums.map((album) => {
                        const count = media.filter(
                            (m) => m.album_id === album.id && m.media_type === 'image'
                        ).length;
                        return (
                            <button
                                key={album.id}
                                onClick={() => setActiveAlbum(album.id)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${activeAlbum === album.id
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {album.name}
                                <span className="ml-1.5 text-xs opacity-60">{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Photo Grid */}
            <GalleryGrid media={media} albumFilter={activeAlbum} />
        </div>
    );
}


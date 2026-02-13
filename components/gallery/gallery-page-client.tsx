'use client';

import { useState } from 'react';
import { GalleryGrid } from './gallery-grid';
import type { GalleryMediaItem } from '@/actions/gallery';

interface GalleryPageClientProps {
    media: GalleryMediaItem[];
    albums: { id: string; name: string }[];
}

export function GalleryPageClient({ media, albums }: GalleryPageClientProps) {
    const [activeAlbum, setActiveAlbum] = useState<string | null>(null);

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

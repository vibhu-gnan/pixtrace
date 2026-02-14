'use client';

import { useState, useEffect, useRef } from 'react';
import { GalleryGrid } from './gallery-grid';
import type { GalleryMediaItem } from '@/actions/gallery';

interface GalleryPageClientProps {
    media: GalleryMediaItem[];
    albums: { id: string; name: string }[];
    eventHash: string;
    eventName: string;
    description: string | null;
}

export function GalleryPageClient({ media, albums, eventHash, eventName, description }: GalleryPageClientProps) {
    const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
    const [revoked, setRevoked] = useState(false);
    const [copied, setCopied] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);

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
            } catch { /* skip */ }
        }, 30_000);
        return () => clearInterval(interval);
    }, [eventHash]);

    const handleCopyLink = async () => {
        const url = window.location.href;
        try { await navigator.clipboard.writeText(url); }
        catch {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: eventName, url }); }
            catch { /* cancelled */ }
        } else {
            handleCopyLink();
        }
    };

    const handleDownloadAll = () => {
        // Download the current page URL (browser will offer to save)
        // For now, copy link as a useful action
        handleCopyLink();
    };

    // Revoked overlay
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

    const images = media.filter(m => m.media_type === 'image');

    return (
        <>
            {/* ── Sticky Info Bar ───────────────────────────────── */}
            <div
                ref={barRef}
                className="sticky top-0 z-30 bg-white border-b border-gray-200"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14">
                        {/* Left: Event name + description */}
                        <div className="flex items-center gap-6 min-w-0 overflow-x-auto">
                            <div className="flex-shrink-0">
                                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide leading-tight">{eventName}</h2>
                                {description && (
                                    <p className="text-[11px] text-gray-400 leading-tight">{description}</p>
                                )}
                            </div>

                            {/* Album tabs */}
                            {albums.length > 1 && (
                                <nav className="flex items-center gap-1 flex-shrink-0">
                                    {albums.map((album) => {
                                        const isActive = activeAlbum === album.id;
                                        return (
                                            <button
                                                key={album.id}
                                                onClick={() => setActiveAlbum(isActive ? null : album.id)}
                                                className={`px-3 py-1 text-xs font-medium tracking-wide uppercase whitespace-nowrap transition-colors ${isActive
                                                    ? 'text-gray-900 border-b-2 border-gray-900'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {album.name}
                                            </button>
                                        );
                                    })}
                                </nav>
                            )}
                        </div>

                        {/* Right: Action icons */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            {/* Photo count */}
                            <span className="text-xs text-gray-400 mr-2 hidden sm:block">
                                {images.length} photos
                            </span>

                            {/* Copy/Like */}
                            <button
                                onClick={handleCopyLink}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors group relative"
                                title="Copy link"
                            >
                                {copied ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                )}
                            </button>

                            {/* Download */}
                            <button
                                onClick={handleDownloadAll}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                title="Download"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>

                            {/* Share */}
                            <button
                                onClick={handleShare}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                title="Share"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Photo Grid ───────────────────────────────────── */}
            <div>
                <GalleryGrid media={media} albumFilter={activeAlbum} />
            </div>
        </>
    );
}

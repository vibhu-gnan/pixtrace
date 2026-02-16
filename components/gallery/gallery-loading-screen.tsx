'use client';

import { useState, useEffect, useRef } from 'react';
import type { LogoDisplay } from '@/actions/gallery-theme';

interface GalleryLoadingScreenProps {
    logoUrl: string | null;
    logoDisplay: LogoDisplay;
}

/**
 * Full-screen loading overlay shown via Suspense while the gallery page streams in.
 *
 * - Logo mode: Branded logo with fade-in + gentle pulse animation, spinner beneath
 * - Spinner mode: Simple circular spinner (no logo uploaded, or fallback on error)
 *
 * Safety: 3-second timeout on logo load — falls back to spinner if R2 is slow.
 * onError handler catches broken logo URLs.
 */
export function GalleryLoadingScreen({ logoUrl, logoDisplay }: GalleryLoadingScreenProps) {
    const showLogo = !!logoUrl && logoDisplay !== 'none';
    const [logoLoaded, setLogoLoaded] = useState(false);
    const [logoFailed, setLogoFailed] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 3-second timeout: if logo hasn't loaded, fall back to spinner
    useEffect(() => {
        if (!showLogo) return;
        timeoutRef.current = setTimeout(() => {
            setLogoFailed(true);
        }, 3000);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [showLogo]);

    const handleLogoLoad = () => {
        setLogoLoaded(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handleLogoError = () => {
        setLogoFailed(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const useLogoMode = showLogo && !logoFailed;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
            {useLogoMode ? (
                <div className="flex flex-col items-center gap-6">
                    {/* Logo with fade-in and pulse */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={logoUrl!}
                        alt="Loading"
                        onLoad={handleLogoLoad}
                        onError={handleLogoError}
                        className={`h-20 sm:h-24 md:h-28 max-w-[60vw] object-contain transition-opacity duration-300 ${logoLoaded ? 'opacity-100 animate-[logoPulse_1.5s_ease-in-out_infinite]' : 'opacity-0'
                            }`}
                    />
                    {/* Spinner beneath logo — only show after logo is visible */}
                    {logoLoaded && (
                        <div className="w-6 h-6 border-[2.5px] border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                    )}
                    {/* While logo is loading, show a small spinner as placeholder */}
                    {!logoLoaded && (
                        <div className="w-8 h-8 border-[3px] border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                    )}
                </div>
            ) : (
                /* Simple spinner mode */
                <div className="w-8 h-8 border-[3px] border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            )}
        </div>
    );
}

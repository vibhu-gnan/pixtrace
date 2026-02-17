'use client';

import { useState, useEffect, useRef } from 'react';
import type { LogoDisplay } from '@/actions/gallery-theme';

interface GalleryLoadingScreenProps {
    logoUrl: string | null;
    logoDisplay: LogoDisplay;
    customPreloader?: string | null;
}

/**
 * Full-screen loading overlay shown via Suspense while the gallery page streams in.
 *
 * Priority order:
 * 1. Custom preloader HTML (rendered in sandboxed iframe — safe, isolated CSS)
 * 2. Logo mode: Branded logo with fade-in + gentle pulse animation
 * 3. Spinner mode: Simple circular spinner (fallback)
 *
 * Safety: 3-second timeout on logo load, iframe sandbox blocks scripts.
 */
export function GalleryLoadingScreen({ logoUrl, logoDisplay, customPreloader }: GalleryLoadingScreenProps) {
    // ── Custom preloader mode ──────────────────────────────────
    if (customPreloader) {
        return (
            <div className="fixed inset-0 z-50">
                <iframe
                    srcDoc={customPreloader}
                    sandbox=""
                    title="Loading"
                    className="w-full h-full border-0"
                    style={{ display: 'block' }}
                />
            </div>
        );
    }

    // ── Logo / Spinner mode ────────────────────────────────────
    return <LogoOrSpinnerLoader logoUrl={logoUrl} logoDisplay={logoDisplay} />;
}

/**
 * Inner component for logo/spinner modes.
 * Separated so the custom preloader path avoids unnecessary hook initialization.
 */
function LogoOrSpinnerLoader({ logoUrl, logoDisplay }: { logoUrl: string | null; logoDisplay: LogoDisplay }) {
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={logoUrl!}
                        alt="Loading"
                        onLoad={handleLogoLoad}
                        onError={handleLogoError}
                        className={`h-20 sm:h-24 md:h-28 max-w-[60vw] object-contain transition-opacity duration-300 ${logoLoaded ? 'opacity-100 animate-[logoPulse_1.5s_ease-in-out_infinite]' : 'opacity-0'
                            }`}
                    />
                    {logoLoaded && (
                        <div className="w-6 h-6 border-[2.5px] border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                    )}
                    {!logoLoaded && (
                        <div className="w-8 h-8 border-[3px] border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                    )}
                </div>
            ) : (
                <div className="w-8 h-8 border-[3px] border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            )}
        </div>
    );
}

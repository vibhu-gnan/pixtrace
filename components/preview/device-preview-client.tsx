'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────

type DeviceMode = 'desktop' | 'mobile';

interface DevicePreviewClientProps {
    eventId: string;
    eventName: string;
    eventHash: string;
    isPublished: boolean;
}

// ─── Icons (inline SVGs — project convention) ───────────────

function ArrowLeftIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    );
}

function MonitorIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    );
}

function SmartphoneIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
    );
}

function ExternalLinkIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

function RefreshIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
    );
}

function DevicePreviewIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <rect x="15" y="8" width="7" height="12" rx="1" ry="1" fill="currentColor" opacity="0.15" />
        </svg>
    );
}

// ─── Shimmer keyframes (injected once) ──────────────────────

const shimmerCSS = `
@keyframes preview-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.preview-shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 60%, transparent 100%);
  background-size: 400px 100%;
  animation: preview-shimmer 1.8s ease-in-out infinite;
}
`;

// ─── Desktop Skeleton ───────────────────────────────────────

function DesktopSkeleton() {
    return (
        <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col">
            <style dangerouslySetInnerHTML={{ __html: shimmerCSS }} />
            {/* Hero area — full width image placeholder */}
            <div className="relative w-full h-[55%] bg-gray-800">
                <div className="absolute inset-0 preview-shimmer" />
                {/* Overlay text skeleton */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-32 h-3 bg-white/10 rounded preview-shimmer" />
                    <div className="w-56 h-6 bg-white/15 rounded preview-shimmer" />
                    <div className="w-24 h-2.5 bg-white/8 rounded preview-shimmer mt-1" />
                    <div className="w-28 h-8 border border-white/20 rounded mt-3 preview-shimmer" />
                </div>
            </div>
            {/* Gallery grid skeleton — 4 columns */}
            <div className="flex-1 bg-gray-950 p-3">
                {/* Sticky bar */}
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="w-28 h-3 bg-white/8 rounded preview-shimmer" />
                    <div className="flex gap-1.5">
                        <div className="w-12 h-5 bg-white/6 rounded-full preview-shimmer" />
                        <div className="w-14 h-5 bg-white/6 rounded-full preview-shimmer" />
                        <div className="w-10 h-5 bg-white/6 rounded-full preview-shimmer" />
                    </div>
                </div>
                {/* Photo grid — 4 columns */}
                <div className="grid grid-cols-4 gap-1.5">
                    {[72, 56, 64, 80, 60, 72, 48, 64, 56, 72, 64, 52].map((h, i) => (
                        <div key={i} className="bg-white/[0.04] rounded preview-shimmer" style={{ paddingBottom: `${h}%` }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Mobile Skeleton ────────────────────────────────────────

function MobileSkeleton() {
    return (
        <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col">
            <style dangerouslySetInnerHTML={{ __html: shimmerCSS }} />
            {/* Hero area — taller on mobile */}
            <div className="relative w-full h-[45%] bg-gray-800">
                <div className="absolute inset-0 preview-shimmer" />
                {/* Overlay text skeleton */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="w-20 h-2.5 bg-white/10 rounded preview-shimmer" />
                    <div className="w-36 h-5 bg-white/15 rounded preview-shimmer" />
                    <div className="w-16 h-2 bg-white/8 rounded preview-shimmer mt-0.5" />
                    <div className="w-24 h-7 border border-white/20 rounded mt-2.5 preview-shimmer" />
                </div>
            </div>
            {/* Gallery grid skeleton — 2 columns */}
            <div className="flex-1 bg-gray-950 p-2">
                {/* Sticky bar */}
                <div className="flex items-center justify-between mb-2 px-0.5">
                    <div className="w-20 h-2.5 bg-white/8 rounded preview-shimmer" />
                    <div className="w-5 h-5 bg-white/6 rounded preview-shimmer" />
                </div>
                {/* Photo grid — 2 columns */}
                <div className="grid grid-cols-2 gap-1">
                    {[80, 64, 72, 56, 64, 80, 56, 72].map((h, i) => (
                        <div key={i} className="bg-white/[0.04] rounded-sm preview-shimmer" style={{ paddingBottom: `${h}%` }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Error State ────────────────────────────────────────────

function IframeErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
            </div>
            <p className="text-sm text-white/70">Failed to load gallery</p>
            <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
                <RefreshIcon />
                Try Again
            </button>
        </div>
    );
}

// ─── Laptop Frame ───────────────────────────────────────────

function LaptopFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center w-[82%] max-w-[1190px]">
            {/* Screen bezel */}
            <div className="relative w-full bg-[#1a1a1a] rounded-t-xl pt-6 pb-4 px-5">
                {/* Webcam dot */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#2a2a2a] border border-[#333]" />

                {/* Screen area */}
                <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden bg-black">
                    {children}
                </div>
            </div>

            {/* Keyboard base */}
            <div className="w-[calc(100%+16px)] h-3.5 bg-gradient-to-b from-[#2a2a2a] to-[#1f1f1f] rounded-b" />

            {/* Keyboard front lip */}
            <div className="w-[20%] h-1 bg-[#333] rounded-b-sm" />
        </div>
    );
}

// ─── Phone Frame ────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative bg-[#1a1a1a] rounded-[42px] p-3 w-[289px] sm:w-[332px] shadow-[inset_0_0_0_2px_#2a2a2a,0_0_0_1px_rgba(255,255,255,0.05)]">
            {/* Dynamic island */}
            <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-[76px] h-[22px] bg-[#1a1a1a] rounded-full z-10" />

            {/* Screen area */}
            <div className="relative w-full aspect-[9/19.5] rounded-[28px] overflow-hidden bg-black">
                {children}
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[96px] h-1 bg-[#444] rounded-full z-10" />
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────

export function DevicePreviewClient({
    eventId,
    eventName,
    eventHash,
    isPublished,
}: DevicePreviewClientProps) {
    const router = useRouter();
    const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const galleryUrl = `/gallery/${eventHash}`;

    // ── Keyboard shortcuts ──────────────────────────────────
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            // Don't intercept when typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Escape') router.push(`/events/${eventId}/photos`);
            if (e.key === 'd' || e.key === 'D') setDeviceMode('desktop');
            if (e.key === 'm' || e.key === 'M') setDeviceMode('mobile');
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [router, eventId]);

    // ── Timeout: show fallback after 15s ────────────────────
    useEffect(() => {
        if (iframeLoaded || iframeError) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }
        timeoutRef.current = setTimeout(() => {
            if (!iframeLoaded) setIframeError(true);
        }, 15000);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [iframeLoaded, iframeError, iframeKey]);

    // ── Iframe handlers ─────────────────────────────────────
    const handleIframeLoad = useCallback(() => {
        setIframeLoaded(true);
        setIframeError(false);
    }, []);

    const handleIframeError = useCallback(() => {
        setIframeError(true);
        setIframeLoaded(false);
    }, []);

    const handleRetry = useCallback(() => {
        setIframeLoaded(false);
        setIframeError(false);
        setIframeKey(k => k + 1);
    }, []);

    // ── Responsive: force mobile mode on small screens ──────
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth < 768) {
                setDeviceMode('mobile');
            }
        }
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── Reset loading state when switching device modes ────────
    const prevModeRef = useRef(deviceMode);
    useEffect(() => {
        if (prevModeRef.current !== deviceMode) {
            prevModeRef.current = deviceMode;
            setIframeLoaded(false);
            setIframeError(false);
        }
    }, [deviceMode]);

    // ── Iframe element builder (device-specific skeleton) ────
    const buildIframeContent = (mode: DeviceMode) => (
        <>
            {!iframeLoaded && !iframeError && (
                mode === 'desktop' ? <DesktopSkeleton /> : <MobileSkeleton />
            )}
            {iframeError && <IframeErrorState onRetry={handleRetry} />}
            <iframe
                key={`${iframeKey}-${mode}`}
                src={galleryUrl}
                title={`Preview: ${eventName}`}
                className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-500 ${
                    iframeLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                allow="autoplay"
            />
        </>
    );

    return (
        <div className="fixed inset-0 flex flex-col bg-gray-950 z-50">
            {/* ── Toolbar ────────────────────────────────────── */}
            <div className="flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-gray-200 flex-shrink-0">
                {/* Left: Back button */}
                <Link
                    href={`/events/${eventId}/photos`}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeftIcon />
                    <span className="hidden sm:inline">Back to Event</span>
                </Link>

                {/* Center: Device toggle + Draft badge */}
                <div className="flex items-center gap-3">
                    {/* Device toggle — hidden on small screens (phone-only) */}
                    <div className="hidden md:flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setDeviceMode('desktop')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                deviceMode === 'desktop'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <MonitorIcon />
                            Desktop
                        </button>
                        <button
                            onClick={() => setDeviceMode('mobile')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                deviceMode === 'mobile'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <SmartphoneIcon />
                            Mobile
                        </button>
                    </div>

                    {/* Draft badge */}
                    {!isPublished && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Draft
                        </span>
                    )}
                </div>

                {/* Right: Open in new tab */}
                <a
                    href={galleryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <span className="hidden sm:inline">Open in tab</span>
                    <ExternalLinkIcon />
                </a>
            </div>

            {/* ── Preview Area ───────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden p-2 sm:p-4">
                {/* Device frame — w-full needed so LaptopFrame's w-[90%] resolves correctly */}
                <div className={`transition-all duration-300 ease-in-out ${
                    deviceMode === 'desktop' ? 'w-full flex justify-center' : ''
                }`}>
                    {deviceMode === 'desktop' ? (
                        <LaptopFrame>{buildIframeContent('desktop')}</LaptopFrame>
                    ) : (
                        <PhoneFrame>{buildIframeContent('mobile')}</PhoneFrame>
                    )}
                </div>

                {/* Mobile hint (shown only on small screens) */}
                <p className="md:hidden mt-4 text-xs text-gray-500 text-center">
                    Mobile preview shown. Use desktop for laptop view.
                </p>
            </div>

            {/* ── Footer hint ────────────────────────────────── */}
            <div className="flex-shrink-0 py-2.5 text-center border-t border-white/5">
                <p className="text-xs text-gray-500">
                    Preview of how guests will see your gallery
                    <span className="hidden sm:inline text-gray-600 ml-1">
                        &middot; Press <kbd className="px-1 py-0.5 text-[10px] bg-white/10 rounded border border-white/10">D</kbd> for desktop, <kbd className="px-1 py-0.5 text-[10px] bg-white/10 rounded border border-white/10">M</kbd> for mobile, <kbd className="px-1 py-0.5 text-[10px] bg-white/10 rounded border border-white/10">Esc</kbd> to go back
                    </span>
                </p>
            </div>
        </div>
    );
}

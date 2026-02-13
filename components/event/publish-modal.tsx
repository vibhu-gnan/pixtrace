'use client';

import { useEffect, useRef, useState } from 'react';
import { publishEvent } from '@/actions/events';
import QRCode from 'qrcode';

interface PublishModalProps {
    eventId: string;
    eventName: string;
    eventHash: string;
    isAlreadyPublished: boolean;
    isOpen: boolean;
    onClose: () => void;
}

export function PublishModal({ eventId, eventName, eventHash, isAlreadyPublished, isOpen, onClose }: PublishModalProps) {
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);
    const [galleryUrl, setGalleryUrl] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setPublished(false);
            setGalleryUrl('');
            setError('');
            setCopied(false);
            return;
        }

        if (isAlreadyPublished) {
            // Already published — show link/QR instantly, no server call
            const url = `${window.location.origin}/gallery/${eventHash}`;
            setGalleryUrl(url);
            setPublished(true);
        } else {
            // Not yet published — call server action
            handlePublish();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Generate QR once gallery URL is available
    useEffect(() => {
        if (galleryUrl && canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, galleryUrl, {
                width: 200,
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' },
            });
        }
    }, [galleryUrl]);

    async function handlePublish() {
        setPublishing(true);
        setError('');
        try {
            const result = await publishEvent(eventId);
            if (result.error) {
                setError(result.error);
            } else if (result.galleryUrl) {
                setGalleryUrl(result.galleryUrl);
                setPublished(true);
            }
        } catch {
            setError('Failed to publish event');
        }
        setPublishing(false);
    }

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(galleryUrl);
        } catch {
            const input = document.createElement('input');
            input.value = galleryUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadQR = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `${eventName.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: `${eventName} Gallery`, url: galleryUrl });
            } catch { /* user cancelled */ }
        } else {
            handleCopyLink();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
                {/* Publishing state */}
                {publishing && (
                    <div className="p-10 text-center">
                        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Publishing your event...</p>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <p className="text-red-600 font-medium mb-4">{error}</p>
                        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
                            Close
                        </button>
                    </div>
                )}

                {/* Success state — show gallery link & QR */}
                {published && !error && (
                    <div className="p-6">
                        {/* Header */}
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Event Published!</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Anyone with the link can now view your gallery
                            </p>
                        </div>

                        {/* QR Code */}
                        <div className="flex justify-center mb-4">
                            <canvas ref={canvasRef} className="rounded-xl shadow-sm" />
                        </div>

                        {/* Gallery URL */}
                        <div className="bg-gray-50 rounded-xl p-3 mb-4">
                            <p className="text-xs text-gray-400 mb-1">Gallery Link</p>
                            <p className="text-sm text-gray-700 break-all font-mono">{galleryUrl}</p>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <button
                                onClick={handleCopyLink}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                <span className="text-xs font-medium">{copied ? 'Copied!' : 'Copy Link'}</span>
                            </button>
                            <button
                                onClick={handleDownloadQR}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span className="text-xs font-medium">Download QR</span>
                            </button>
                            <button
                                onClick={handleShare}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                                <span className="text-xs font-medium">Share</span>
                            </button>
                        </div>

                        {/* Done button */}
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

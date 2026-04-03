'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { updateEventPermissions, updateEventPhotoOrder, getFaceProcessingProgress, reprocessFaceEmbeddings, triggerFaceProcessing } from '@/actions/events';
import type { FaceProcessingProgress } from '@/actions/events';

// ─── Reusable UI Components ──────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-gray-200'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    );
}

function RadioGroup({
    name,
    options,
    value,
    onChange,
}: {
    name: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-center gap-4">
            {options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${value === opt.value
                            ? 'border-brand-500' // Ensure this color exists in your tailwind config or use proper hex/utility
                            : 'border-gray-300'
                            }`}
                        onClick={() => onChange(opt.value)}
                    >
                        {value === opt.value && (
                            <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                        )}
                    </div>
                    <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
            ))}
        </div>
    );
}

function MonitorIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    );
}

function PhoneIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
    );
}

// ─── Form Component ──────────────────────────────────────────

interface PermissionsFormProps {
    eventId: string;
    initialAllowDownload: boolean;
    initialAllowSlideshow: boolean;
    initialPhotoOrder: 'oldest_first' | 'newest_first';
    initialFaceSearchEnabled: boolean;
    initialShowFaceScores: boolean;
}

export default function PermissionsForm({ eventId, initialAllowDownload, initialAllowSlideshow, initialPhotoOrder, initialFaceSearchEnabled, initialShowFaceScores }: PermissionsFormProps) {
    const [downloadAccess, setDownloadAccess] = useState<'everyone' | 'no_one'>(initialAllowDownload ? 'everyone' : 'no_one');
    const [slideshowEnabled, setSlideshowEnabled] = useState(initialAllowSlideshow);
    const [photoOrder, setPhotoOrder] = useState<'oldest_first' | 'newest_first'>(initialPhotoOrder);
    const [faceSearchEnabled, setFaceSearchEnabled] = useState(initialFaceSearchEnabled);
    const [showFaceScores, setShowFaceScores] = useState(initialShowFaceScores);
    const [faceProgress, setFaceProgress] = useState<FaceProcessingProgress | null>(null);

    // Future proofing UI state (not yet connected to real columns)
    const [allowDownloadRequest, setAllowDownloadRequest] = useState(false);
    const [viewAccess, setViewAccess] = useState('everyone');
    const [allowViewRequest, setAllowViewRequest] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isDownloadPending, startDownloadTransition] = useTransition();
    const [isSlideshowPending, startSlideshowTransition] = useTransition();
    const [isPhotoOrderPending, startPhotoOrderTransition] = useTransition();
    const [isFaceSearchPending, startFaceSearchTransition] = useTransition();
    const [isFaceScoresPending, startFaceScoresTransition] = useTransition();
    const [isReprocessPending, startReprocessTransition] = useTransition();
    const [reprocessConfirm, setReprocessConfirm] = useState(false);
    const [isTriggerPending, startTriggerTransition] = useTransition();
    const [triggerResult, setTriggerResult] = useState<{ dispatched?: number; error?: string } | null>(null);

    // Optimistic updates could be added, but simple transition is fine for settings

    const handleDownloadChange = (value: string) => {
        const newVal = value as 'everyone' | 'no_one';
        const prevVal = downloadAccess;
        setDownloadAccess(newVal);
        setError(null);

        startDownloadTransition(async () => {
            try {
                const result = await updateEventPermissions(eventId, { allowDownload: newVal === 'everyone' });
                if (result.error) throw new Error(result.error);
            } catch (err) {
                console.error(err);
                setDownloadAccess(prevVal);
                setError('Failed to update download permissions');
            }
        });
    };

    const handleSlideshowChange = (checked: boolean) => {
        const prevVal = slideshowEnabled;
        setSlideshowEnabled(checked);
        setError(null);

        startSlideshowTransition(async () => {
            try {
                const result = await updateEventPermissions(eventId, { allowSlideshow: checked });
                if (result.error) throw new Error(result.error);
            } catch (err) {
                console.error(err);
                setSlideshowEnabled(prevVal);
                setError('Failed to update slideshow settings');
            }
        });
    };

    const handlePhotoOrderChange = (value: string) => {
        const newOrder = value as 'oldest_first' | 'newest_first';
        const prevOrder = photoOrder;
        setPhotoOrder(newOrder);
        setError(null);

        startPhotoOrderTransition(async () => {
            try {
                const result = await updateEventPhotoOrder(eventId, newOrder);
                if (result.error) throw new Error(result.error);
            } catch (err) {
                console.error(err);
                setPhotoOrder(prevOrder);
                setError('Failed to update photo order');
            }
        });
    };

    const handleFaceSearchChange = (checked: boolean) => {
        const prevVal = faceSearchEnabled;
        setFaceSearchEnabled(checked);
        setError(null);
        setTriggerResult(null);

        startFaceSearchTransition(async () => {
            try {
                const result = await updateEventPermissions(eventId, { faceSearchEnabled: checked });
                if (result.error) throw new Error(result.error);
                if (checked) {
                    const progress = await getFaceProcessingProgress(eventId);
                    setFaceProgress(progress);
                    // Explicitly trigger from client so Vercel doesn't kill the background fetch
                    if (progress && progress.pending > 0) {
                        const trigResult = await triggerFaceProcessing(eventId);
                        setTriggerResult(trigResult);
                    }
                }
            } catch (err) {
                console.error(err);
                setFaceSearchEnabled(prevVal);
                setError('Failed to update face search settings');
            }
        });
    };

    const handleTriggerProcessing = () => {
        setTriggerResult(null);
        setError(null);
        startTriggerTransition(async () => {
            const result = await triggerFaceProcessing(eventId);
            setTriggerResult(result);
            if (!result.error) {
                // Refresh progress after trigger
                const progress = await getFaceProcessingProgress(eventId);
                setFaceProgress(progress);
            }
        });
    };

    const handleShowFaceScoresChange = (checked: boolean) => {
        const prevVal = showFaceScores;
        setShowFaceScores(checked);
        setError(null);

        startFaceScoresTransition(async () => {
            try {
                const result = await updateEventPermissions(eventId, { showFaceScores: checked });
                if (result.error) throw new Error(result.error);
            } catch (err) {
                console.error(err);
                setShowFaceScores(prevVal);
                setError('Failed to update face score display settings');
            }
        });
    };

    const handleReprocess = () => {
        setReprocessConfirm(false);
        setError(null);
        startReprocessTransition(async () => {
            const result = await reprocessFaceEmbeddings(eventId);
            if (result.error) {
                setError(result.error);
            } else {
                // Reset progress display — polling will pick up the fresh pending jobs
                setFaceProgress(null);
                const progress = await getFaceProcessingProgress(eventId);
                setFaceProgress(progress);
            }
        });
    };

    // Poll face processing progress when enabled
    const fetchProgress = useCallback(async () => {
        const progress = await getFaceProcessingProgress(eventId);
        setFaceProgress(progress);
        return progress;
    }, [eventId]);

    useEffect(() => {
        if (!faceSearchEnabled) return;
        fetchProgress();

        const interval = setInterval(async () => {
            const progress = await fetchProgress();
            // Stop polling when all jobs are done
            if (progress && progress.pending === 0 && progress.processing === 0) {
                clearInterval(interval);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [faceSearchEnabled, fetchProgress]);

    return (
        <div>
            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}
            <div className="max-w-3xl space-y-10">

                {/* Download Section */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${isDownloadPending ? 'opacity-60 pointer-events-none' : ''}`}>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Download</h3>
                        <RadioGroup
                            name="download"
                            options={[
                                { value: 'everyone', label: 'Everyone' },
                                { value: 'no_one', label: 'no one' },
                            ]}
                            value={downloadAccess}
                            onChange={handleDownloadChange}
                        />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Allow download request?</h3>
                        <div className="flex items-center gap-3">
                            <Toggle checked={allowDownloadRequest} onChange={setAllowDownloadRequest} disabled={true} />
                            <span className="text-sm text-gray-600">Yes (Coming Soon)</span>
                        </div>
                    </div>
                </div>

                {/* View Section (Placeholder for future) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-3">View</h3>
                        <RadioGroup
                            name="view"
                            options={[
                                { value: 'everyone', label: 'Everyone' },
                                { value: 'bmu_id', label: 'BMU ID' },
                                { value: 'no_one', label: 'no one' },
                            ]}
                            value={viewAccess}
                            onChange={setViewAccess}
                        />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Allow view request?</h3>
                        <div className="flex items-center gap-3">
                            <Toggle checked={allowViewRequest} onChange={setAllowViewRequest} disabled={true} />
                            <span className="text-sm text-gray-600">Yes (Coming Soon)</span>
                        </div>
                    </div>
                </div>

                {/* Slideshow Section */}
                <div className={isSlideshowPending ? 'opacity-60 pointer-events-none' : ''}>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Slideshow</h3>
                    <div className="flex items-center gap-3 mb-2">
                        <Toggle checked={slideshowEnabled} onChange={handleSlideshowChange} />
                        <span className="text-sm text-gray-600">Yes</span>
                    </div>
                    <p className="text-sm text-gray-400">
                        Allow visitors to view the images in their collection as a slideshow.
                    </p>
                </div>

                {/* Face Search Section */}
                <div className={isFaceSearchPending ? 'opacity-60 pointer-events-none' : ''}>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Face Search</h3>
                    <div className="flex items-center gap-3 mb-2">
                        <Toggle checked={faceSearchEnabled} onChange={handleFaceSearchChange} />
                        <span className="text-sm text-gray-600">{faceSearchEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <p className="text-sm text-gray-400">
                        Allow visitors to find their photos by taking a selfie. Uses AI to detect and match faces.
                    </p>

                    {/* Processing Progress */}
                    {faceSearchEnabled && faceProgress && faceProgress.total > 0 && (
                        <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Processing Progress</span>
                                <span className="text-sm text-gray-500">
                                    {faceProgress.completed + faceProgress.noFaces} / {faceProgress.total}
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500 ease-out bg-brand-500"
                                    style={{
                                        width: `${Math.round(((faceProgress.completed + faceProgress.noFaces) / faceProgress.total) * 100)}%`,
                                    }}
                                />
                            </div>
                            {/* Status breakdown */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                                {faceProgress.completed > 0 && (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        {faceProgress.completed} with faces
                                    </span>
                                )}
                                {faceProgress.noFaces > 0 && (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                                        {faceProgress.noFaces} no faces
                                    </span>
                                )}
                                {faceProgress.processing > 0 && (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        {faceProgress.processing} processing
                                    </span>
                                )}
                                {faceProgress.pending > 0 && (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                        {faceProgress.pending} queued
                                    </span>
                                )}
                                {faceProgress.failed > 0 && (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-500" />
                                        {faceProgress.failed} failed
                                    </span>
                                )}
                            </div>
                            {/* Status message */}
                            {faceProgress.processing > 0 && (
                                <p className="mt-2 text-xs text-gray-400">
                                    Processing photos... This page updates automatically.
                                </p>
                            )}
                            {faceProgress.pending > 0 && faceProgress.processing === 0 && (
                                <div className="mt-2 flex items-center gap-3 flex-wrap">
                                    <p className="text-xs text-amber-600">
                                        {faceProgress.pending} photo{faceProgress.pending !== 1 ? 's' : ''} queued — not yet picked up by the processor.
                                    </p>
                                    <button
                                        onClick={handleTriggerProcessing}
                                        disabled={isTriggerPending || isFaceSearchPending}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isTriggerPending ? (
                                            <>
                                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                </svg>
                                                Triggering...
                                            </>
                                        ) : 'Process Now'}
                                    </button>
                                </div>
                            )}
                            {triggerResult && !triggerResult.error && triggerResult.dispatched !== undefined && (
                                <p className="mt-1 text-xs text-green-600">
                                    Dispatched {triggerResult.dispatched} photo{triggerResult.dispatched !== 1 ? 's' : ''} to processor.
                                </p>
                            )}
                            {triggerResult?.error && (
                                <p className="mt-1 text-xs text-red-500">{triggerResult.error}</p>
                            )}
                            {faceProgress.pending === 0 && faceProgress.processing === 0 && (
                                <p className="mt-2 text-xs text-green-600">
                                    All photos processed. Face search is ready!
                                </p>
                            )}
                        </div>
                    )}

                    {faceSearchEnabled && faceProgress && faceProgress.total === 0 && (
                        <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-100">
                            <p className="text-sm text-gray-500">
                                No photos have been queued for face processing yet. Photos will be processed when uploaded or when the processing pipeline runs.
                            </p>
                        </div>
                    )}

                    {/* Recalculate Embeddings */}
                    {faceSearchEnabled && (
                        <div className="mt-4">
                            {!reprocessConfirm ? (
                                <button
                                    onClick={() => setReprocessConfirm(true)}
                                    disabled={isReprocessPending || isFaceSearchPending}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isReprocessPending ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            Resetting queue...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                <path d="M3 3v5h5" />
                                            </svg>
                                            Recalculate embeddings
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    <span className="text-sm text-amber-800 flex-1">
                                        This will delete all existing embeddings and requeue all {faceProgress?.total ?? ''} photos. Continue?
                                    </span>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => setReprocessConfirm(false)}
                                            className="px-3 py-1 text-xs rounded-md text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleReprocess}
                                            className="px-3 py-1 text-xs rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors font-medium"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Show Face Scores Sub-toggle */}
                    {faceSearchEnabled && (
                        <div className={`mt-4 pl-4 border-l-2 border-gray-200 ${isFaceScoresPending ? 'opacity-60 pointer-events-none' : ''}`}>
                            <div className="flex items-center gap-3 mb-1">
                                <Toggle checked={showFaceScores} onChange={handleShowFaceScoresChange} />
                                <span className="text-sm text-gray-600">Show confidence scores</span>
                            </div>
                            <p className="text-sm text-gray-400">
                                Display match confidence scores on gallery thumbnails when visitors use face search.
                            </p>
                        </div>
                    )}
                </div>

                {/* Photo Order Section */}
                <div className={isPhotoOrderPending ? 'opacity-60 pointer-events-none' : ''}>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Photo Order</h3>
                    <RadioGroup
                        name="photoOrder"
                        options={[
                            { value: 'oldest_first', label: 'Oldest first' },
                            { value: 'newest_first', label: 'Newest first' },
                        ]}
                        value={photoOrder}
                        onChange={handlePhotoOrderChange}
                    />
                    <p className="text-sm text-gray-400 mt-2">
                        Controls the order photos appear in the public gallery.
                    </p>
                </div>
            </div>

            {/* Device Preview Icons */}
            <div className="flex items-center justify-center gap-3 mt-16">
                <button className="p-2 rounded-lg bg-orange-50 text-orange-500"> {/* Using orange/brand guess */}
                    <MonitorIcon />
                </button>
                <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                    <PhoneIcon />
                </button>
            </div>
        </div>
    );
}

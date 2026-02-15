'use client';

import { useState, useTransition } from 'react';
import { updateEventPermissions } from '@/actions/events';

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
}

export default function PermissionsForm({ eventId, initialAllowDownload, initialAllowSlideshow }: PermissionsFormProps) {
    const [downloadAccess, setDownloadAccess] = useState<'everyone' | 'no_one'>(initialAllowDownload ? 'everyone' : 'no_one');
    const [slideshowEnabled, setSlideshowEnabled] = useState(initialAllowSlideshow);

    // Future proofing UI state (not yet connected to real columns)
    const [allowDownloadRequest, setAllowDownloadRequest] = useState(false);
    const [viewAccess, setViewAccess] = useState('everyone');
    const [allowViewRequest, setAllowViewRequest] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Optimistic updates could be added, but simple transition is fine for settings

    const handleDownloadChange = (value: string) => {
        const newVal = value as 'everyone' | 'no_one';
        const prevVal = downloadAccess;
        setDownloadAccess(newVal);
        setError(null);

        startTransition(async () => {
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

        startTransition(async () => {
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
            <div className={`max-w-3xl space-y-10 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>

                {/* Download Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Slideshow</h3>
                    <div className="flex items-center gap-3 mb-2">
                        <Toggle checked={slideshowEnabled} onChange={handleSlideshowChange} />
                        <span className="text-sm text-gray-600">Yes</span>
                    </div>
                    <p className="text-sm text-gray-400">
                        Allow visitors to view the images in their collection as a slideshow.
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

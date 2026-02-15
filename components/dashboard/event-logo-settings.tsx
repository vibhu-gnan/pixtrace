
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateEventLogo } from '@/actions/events';

interface EventLogoSettingsProps {
    eventId: string;
    initialLogoUrl?: string | null;
}

export function EventLogoSettings({ eventId, initialLogoUrl }: EventLogoSettingsProps) {
    const router = useRouter();
    const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl || null);
    const [isUploading, setIsUploading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        // Validate file size (e.g., 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        setIsUploading(true);
        try {
            // 1. Get presigned URL
            const res = await fetch('/api/upload/logo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                    eventId,
                }),
            });

            if (!res.ok) throw new Error('Failed to get upload URL');
            const { uploadUrl, url } = await res.json();

            // 2. Upload to R2
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
            });

            if (!uploadRes.ok) throw new Error('Failed to upload file');

            // 3. Update event in DB
            const result = await updateEventLogo(eventId, url);
            if (result.error) throw new Error(result.error);

            setLogoUrl(url);
            router.refresh();
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Failed to upload logo');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemove = async () => {
        if (!confirm('Are you sure you want to remove the logo?')) return;

        setIsRemoving(true);
        try {
            const result = await updateEventLogo(eventId, null);
            if (result.error) throw new Error(result.error);
            setLogoUrl(null);
            router.refresh();
        } catch (error) {
            console.error('Error removing logo:', error);
            alert('Failed to remove logo');
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Logo</h2>

            <div className="space-y-4">
                <p className="text-sm text-gray-500">
                    Upload a logo to appear on your event&apos;s cover page.
                    <br />
                    Recommended: Transparent PNG, max 5MB.
                </p>

                <div className="flex items-start gap-6">
                    {/* Preview */}
                    <div className="relative w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={logoUrl}
                                alt="Event Logo"
                                className="max-w-full max-h-full object-contain p-2"
                            />
                        ) : (
                            <span className="text-xs text-gray-400">No logo</span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={isUploading || isRemoving}
                                id="logo-upload"
                            />
                            <label
                                htmlFor="logo-upload"
                                className={`inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer ${(isUploading || isRemoving) ? 'opacity-50 pointer-events-none' : ''
                                    }`}
                            >
                                {isUploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                            </label>
                        </div>

                        {logoUrl && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={isUploading || isRemoving}
                                className="text-sm text-red-600 hover:text-red-700 text-left disabled:opacity-50"
                            >
                                {isRemoving ? 'Removing...' : 'Remove Logo'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

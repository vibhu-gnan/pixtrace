'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateEventHero } from '@/actions/events';
import { uploadHeroImage } from '@/actions/upload';
import { GalleryMediaItem } from '@/actions/gallery';
import { EventData } from '@/actions/events';

interface HeroCoverSettingsProps {
    event: EventData;
    media: GalleryMediaItem[]; // For "Select from Gallery"
    albums: { id: string; name: string }[]; // For "Slideshow - Album"
}

type CoverType = 'first' | 'single' | 'upload' | 'slideshow';

export function HeroCoverSettings({ event, media, albums }: HeroCoverSettingsProps) {
    const router = useRouter();
    const [coverType, setCoverType] = useState<CoverType>(event.cover_type || 'first');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // State for different modes
    const [selectedMediaId, setSelectedMediaId] = useState<string | null>(event.cover_media_id);
    const [uploadedR2Key, setUploadedR2Key] = useState<string | null>(event.cover_r2_key);
    const [slideshowType, setSlideshowType] = useState<'album' | 'custom'>(
        event.cover_slideshow_config?.type || 'album'
    );
    const [slideshowAlbumId, setSlideshowAlbumId] = useState<string | null>(
        event.cover_slideshow_config?.albumId || (albums[0]?.id ?? null)
    );
    const [slideshowMediaIds, setSlideshowMediaIds] = useState<string[]>(
        event.cover_slideshow_config?.mediaIds || []
    );

    // Modals (mocked with simple state for now, ideally separate components)
    const [showMediaSelector, setShowMediaSelector] = useState(false);
    const [showMultiSelector, setShowMultiSelector] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        setLoading(true);
        const payload: any = { coverType };

        if (coverType === 'single') {
            payload.coverMediaId = selectedMediaId;
        } else if (coverType === 'upload') {
            payload.coverR2Key = uploadedR2Key;
        } else if (coverType === 'slideshow') {
            payload.coverSlideshowConfig = {
                type: slideshowType,
                albumId: slideshowType === 'album' ? slideshowAlbumId : undefined,
                mediaIds: slideshowType === 'custom' ? slideshowMediaIds : undefined,
            };
        }

        const res = await updateEventHero(event.id, payload);
        setLoading(false);
        if (res.error) {
            alert(res.error);
        } else {
            router.refresh();
            alert('Cover settings updated!');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', e.target.files[0]);

        const res = await uploadHeroImage(event.id, formData);
        setUploading(false);

        if (res.error) {
            alert(res.error);
        } else if (res.r2Key) {
            setUploadedR2Key(res.r2Key);
            // Auto-save or wait for user to click save? Let's just set state.
        }
    };

    const currentCoverMedia = media.find(m => m.id === selectedMediaId);

    return (
        <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Gallery Cover</h2>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Cover Type Selector */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['first', 'single', 'upload', 'slideshow'] as CoverType[]).map((type) => (
                    <button
                        key={type}
                        onClick={() => setCoverType(type)}
                        className={`p-4 rounded-lg border text-left transition-all ${coverType === type
                                ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <div className="font-medium text-gray-900 capitalize">
                            {type === 'first' ? 'First Photo' : type}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {type === 'first' && 'Default behavior'}
                            {type === 'single' && 'Pick one photo'}
                            {type === 'upload' && 'Upload specific'}
                            {type === 'slideshow' && 'Rotating images'}
                        </div>
                    </button>
                ))}
            </div>

            {/* Configuration Area */}
            <div className="pt-4 border-t border-gray-100">
                {coverType === 'first' && (
                    <p className="text-sm text-gray-500">
                        The first photo in your gallery (sorted by date or custom order) will be displayed as the cover.
                    </p>
                )}

                {coverType === 'single' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            {currentCoverMedia ? (
                                <div className="relative w-24 h-16 bg-gray-100 rounded overflow-hidden">
                                    <img src={currentCoverMedia.thumbnail_url} alt="Selected" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                                    None
                                </div>
                            )}
                            <button
                                onClick={() => setShowMediaSelector(true)}
                                className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                            >
                                Choose Photo
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">Select a photo from your uploaded media to serve as the static cover.</p>
                    </div>
                )}

                {coverType === 'upload' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            {uploadedR2Key ? (
                                <div className="relative w-24 h-16 bg-gray-100 rounded overflow-hidden">
                                    {/* Simplified preview - in real app might need a signed URL for private buckets, 
                       but here we assume public read or specific action to get url. 
                       For now just showing "Uploaded" state or maybe we can't easily preview without a URL.
                       Actually we returned `url` from upload action. But finding it here from just Key is harder 
                       without helper. Let's just show text. 
                   */}
                                    <div className="w-full h-full flex items-center justify-center bg-green-50 text-green-600 text-xs font-medium">
                                        Image Set
                                    </div>
                                </div>
                            ) : (
                                <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                                    None
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                {uploading ? 'Uploading...' : uploadedR2Key ? 'Replace Image' : 'Upload Image'}
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">Upload a high-quality image solely for the cover. It won&apos;t appear in the gallery grid.</p>
                    </div>
                )}

                {coverType === 'slideshow' && (
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={slideshowType === 'album'}
                                    onChange={() => setSlideshowType('album')}
                                    className="rounded-full border-gray-300 text-black focus:ring-black"
                                />
                                <span className="text-sm font-medium">Use Album</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={slideshowType === 'custom'}
                                    onChange={() => setSlideshowType('custom')}
                                    className="rounded-full border-gray-300 text-black focus:ring-black"
                                />
                                <span className="text-sm font-medium">Select Photos</span>
                            </label>
                        </div>

                        {slideshowType === 'album' && (
                            <select
                                value={slideshowAlbumId || ''}
                                onChange={(e) => setSlideshowAlbumId(e.target.value)}
                                className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
                            >
                                {albums.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        )}

                        {slideshowType === 'custom' && (
                            <div>
                                <button
                                    onClick={() => setShowMultiSelector(true)}
                                    className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                                >
                                    Select Photos ({slideshowMediaIds.length})
                                </button>
                            </div>
                        )}

                        <p className="text-sm text-gray-500">
                            {slideshowType === 'album'
                                ? 'All photos in the selected album will rotate in the hero section.'
                                : 'Manually selected photos will rotate in the hero section.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Media Selector Modal (Simple Inline Implementation for now) */}
            {showMediaSelector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold">Select Cover Photo</h3>
                            <button onClick={() => setShowMediaSelector(false)}>✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {media.filter(m => m.media_type === 'image').map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => { setSelectedMediaId(item.id); setShowMediaSelector(false); }}
                                    className="aspect-square bg-gray-100 cursor-pointer hover:opacity-80 relative"
                                >
                                    <img src={item.thumbnail_url} className="w-full h-full object-cover" loading="lazy" />
                                    {selectedMediaId === item.id && (
                                        <div className="absolute inset-0 border-4 border-blue-500" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Multi-Selector Modal */}
            {showMultiSelector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold">Select Slideshow Photos</h3>
                            <button onClick={() => setShowMultiSelector(false)}>Done</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {media.filter(m => m.media_type === 'image').map(item => {
                                const isSelected = slideshowMediaIds.includes(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            setSlideshowMediaIds(prev =>
                                                isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                            );
                                        }}
                                        className="aspect-square bg-gray-100 cursor-pointer relative"
                                    >
                                        <img src={item.thumbnail_url} className={`w-full h-full object-cover ${isSelected ? 'opacity-50' : ''}`} loading="lazy" />
                                        {isSelected && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

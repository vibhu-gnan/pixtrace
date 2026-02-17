'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateEventCustomPreloader } from '@/actions/events';

interface EventCustomPreloaderProps {
    eventId: string;
    initialHtml?: string | null;
}

export function EventCustomPreloader({ eventId, initialHtml }: EventCustomPreloaderProps) {
    const router = useRouter();
    const [html, setHtml] = useState(initialHtml || '');
    const [savedHtml, setSavedHtml] = useState(initialHtml || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isExpanded, setIsExpanded] = useState(!!initialHtml);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

    const hasChanges = html !== savedHtml;
    const charCount = html.length;
    const maxChars = 51200;
    const isOverLimit = charCount > maxChars;

    const handleSave = async () => {
        if (isOverLimit) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            const result = await updateEventCustomPreloader(eventId, html || null);
            if (result.error) throw new Error(result.error);
            setSavedHtml(html);
            setSaveStatus('saved');
            router.refresh();
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Error saving custom preloader:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClear = async () => {
        if (!confirm('Remove custom preloader? The gallery will use the default loading screen.')) return;
        setIsSaving(true);
        try {
            const result = await updateEventCustomPreloader(eventId, null);
            if (result.error) throw new Error(result.error);
            setHtml('');
            setSavedHtml('');
            router.refresh();
        } catch (error) {
            console.error('Error clearing custom preloader:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left"
            >
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Custom Preloader</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {savedHtml ? 'Custom loading animation active' : 'Add a custom HTML loading animation'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {savedHtml && (
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-green-50 text-green-700 rounded-full">
                            Active
                        </span>
                    )}
                    <svg
                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>
            </button>

            {isExpanded && (
                <div className="mt-4 space-y-4">
                    <p className="text-xs text-gray-400">
                        Paste a self-contained HTML file with inline CSS/SVG. This overrides the default logo loading screen.
                        No JavaScript execution (sandboxed). Max 50KB.
                    </p>

                    {/* Textarea */}
                    <div className="relative">
                        <textarea
                            value={html}
                            onChange={(e) => setHtml(e.target.value)}
                            placeholder="<!DOCTYPE html>&#10;<html>&#10;<head>&#10;  <style>/* your CSS */</style>&#10;</head>&#10;<body>&#10;  <!-- your loading animation -->&#10;</body>&#10;</html>"
                            rows={10}
                            className={`w-full rounded-lg border p-3 text-xs font-mono text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-y ${isOverLimit ? 'border-red-300 focus:ring-red-300' : 'border-gray-200'
                                }`}
                            disabled={isSaving}
                        />
                        <div className={`absolute bottom-2 right-3 text-[10px] ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            {(charCount / 1024).toFixed(1)}KB / 50KB
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !hasChanges || isOverLimit || !html.trim()}
                            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? 'Saving...' : 'Save Preloader'}
                        </button>
                        {savedHtml && (
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={isSaving}
                                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                                Remove
                            </button>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="text-xs text-green-600 font-medium">Saved!</span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-xs text-red-500 font-medium">Failed to save</span>
                        )}
                    </div>

                    {/* Live Preview */}
                    {html.trim() && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
                            <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-100" style={{ height: '240px' }}>
                                <iframe
                                    srcDoc={html}
                                    sandbox=""
                                    title="Preloader preview"
                                    className="w-full h-full border-0"
                                    style={{ display: 'block' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

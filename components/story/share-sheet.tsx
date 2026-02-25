'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { StoryTemplate } from '@/lib/story/story-card-generator';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  eventName: string;
  eventSubtitle?: string;
  logoUrl?: string;
  galleryUrl: string;
}

const TEMPLATES: { id: StoryTemplate; label: string }[] = [
  { id: 'full-bleed', label: 'Full Bleed' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'immersive', label: 'Immersive' },
  { id: 'glass-frame', label: 'Glass' },
];

export function ShareSheet({
  isOpen,
  onClose,
  photoUrl,
  eventName,
  eventSubtitle,
  logoUrl,
  galleryUrl,
}: ShareSheetProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate>('immersive');
  const [generating, setGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setGenerating(false);
      setToastMessage('');
    }
  }, [isOpen]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToastMessage(''), 3000);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  }, []);

  const generateCard = useCallback(async (): Promise<{ blob: Blob; file: File } | null> => {
    try {
      const { generateStoryCard } = await import('@/lib/story/story-card-generator');
      const blob = await generateStoryCard({
        photoUrl,
        eventName,
        eventSubtitle,
        logoUrl,
        template: selectedTemplate,
      });
      const file = new File([blob], `${eventName.replace(/\s+/g, '-').toLowerCase()}-story.png`, {
        type: 'image/png',
      });
      return { blob, file };
    } catch (err) {
      console.error('Story generation failed:', err);
      return null;
    }
  }, [photoUrl, eventName, eventSubtitle, logoUrl, selectedTemplate]);

  const handleShareStory = useCallback(async () => {
    if (generating) return;
    setGenerating(true);

    const result = await generateCard();
    if (!result) {
      setGenerating(false);
      showToast('Failed to create story card');
      return;
    }

    // Copy gallery URL
    await copyToClipboard(galleryUrl);

    // Try native share with file
    if (navigator.share && navigator.canShare?.({ files: [result.file] })) {
      try {
        await navigator.share({ files: [result.file], title: `${eventName}` });
        showToast('Link copied! Add a Link Sticker on Instagram');
        setGenerating(false);
        return;
      } catch {
        // User cancelled or share failed — fall through to download
      }
    }

    // Fallback: download
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Saved! Add a Link Sticker on Instagram');
    setGenerating(false);
  }, [generating, generateCard, galleryUrl, eventName, copyToClipboard, showToast]);

  const handleCopyLink = useCallback(async () => {
    await copyToClipboard(galleryUrl);
    showToast('Link copied!');
  }, [galleryUrl, copyToClipboard, showToast]);

  const handleWhatsApp = useCallback(() => {
    const text = `Check out ${eventName}! ${galleryUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }, [eventName, galleryUrl]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full max-w-lg bg-[#282828] rounded-t-2xl animate-in slide-in-from-bottom duration-300"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Template previews — horizontal scroll */}
        <div className="px-4 pb-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 transition-all ${
                  selectedTemplate === tmpl.id ? 'scale-[1.02]' : 'opacity-60'
                }`}
              >
                <div
                  className={`w-[140px] h-[248px] rounded-xl overflow-hidden border-2 transition-colors ${
                    selectedTemplate === tmpl.id
                      ? 'border-white'
                      : 'border-transparent'
                  }`}
                >
                  <TemplatePreview
                    template={tmpl.id}
                    photoUrl={photoUrl}
                    eventName={eventName}
                  />
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    selectedTemplate === tmpl.id ? 'text-white' : 'text-white/40'
                  }`}
                >
                  {tmpl.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Share targets row */}
        <div className="px-4 pb-6">
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
            {/* Instagram Stories */}
            <button
              onClick={handleShareStory}
              disabled={generating}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center">
                {generating ? (
                  <svg className="animate-spin text-white" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="white" strokeWidth="2" />
                    <circle cx="12" cy="12" r="5" fill="none" stroke="white" strokeWidth="2" />
                    <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
                  </svg>
                )}
              </div>
              <span className="text-[11px] text-white/70 font-medium">
                {generating ? 'Creating...' : 'Stories'}
              </span>
            </button>

            {/* Copy Link */}
            <button onClick={handleCopyLink} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-[#3a3a3a] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <span className="text-[11px] text-white/70 font-medium">Copy link</span>
            </button>

            {/* WhatsApp */}
            <button onClick={handleWhatsApp} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-[#25d366] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <span className="text-[11px] text-white/70 font-medium">WhatsApp</span>
            </button>

            {/* More (native share) */}
            <button
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({ title: eventName, url: galleryUrl });
                  } catch { /* cancelled */ }
                } else {
                  await copyToClipboard(galleryUrl);
                  showToast('Link copied!');
                }
              }}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full bg-[#3a3a3a] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                </svg>
              </div>
              <span className="text-[11px] text-white/70 font-medium">More</span>
            </button>
          </div>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="absolute top-[-52px] left-1/2 -translate-x-1/2 bg-white text-gray-900 text-sm font-medium px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini Template Previews ────────────────────────────────────

function TemplatePreview({
  template,
  photoUrl,
  eventName,
}: {
  template: StoryTemplate;
  photoUrl: string;
  eventName: string;
}) {
  const shortName = eventName.length > 18 ? eventName.slice(0, 18) + '...' : eventName;

  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  switch (template) {
    case 'full-bleed':
      return (
        <div className="relative w-full h-full bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" style={imgStyle} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
          <div className="absolute bottom-3 left-0 right-0 text-center px-2">
            <div className="text-[8px] font-bold text-white uppercase tracking-wide leading-tight">
              {shortName}
            </div>
          </div>
        </div>
      );

    case 'polaroid':
      return (
        <div className="relative w-full h-full bg-gray-800 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" style={{ ...imgStyle, filter: 'blur(8px) brightness(0.4)', transform: 'scale(1.3)' }} />
          <div className="relative bg-white rounded-[4px] p-[4px] pb-[14px] w-[75%] shadow-lg z-10">
            <div className="aspect-square w-full rounded-[2px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="text-[6px] font-bold text-gray-900 text-center mt-[6px] uppercase tracking-wide leading-tight">
              {shortName}
            </div>
          </div>
        </div>
      );

    case 'immersive':
      return (
        <div className="relative w-full h-full bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" style={imgStyle} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
          <div className="absolute bottom-3 left-0 right-0 text-center px-2">
            <div className="text-[9px] font-bold text-white uppercase tracking-wide leading-tight">
              {shortName}
            </div>
          </div>
          {/* Logo placeholder at top — only shown if organizer has logo */}
        </div>
      );

    case 'glass-frame':
      return (
        <div className="relative w-full h-full bg-gray-800 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" style={{ ...imgStyle, filter: 'blur(8px) brightness(0.35)', transform: 'scale(1.3)' }} />
          <div className="absolute top-3 left-2 right-2 z-10">
            <div className="bg-white/10 rounded-lg p-[3px] border border-white/10">
              <div className="aspect-square w-full rounded-[4px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-3 left-0 right-0 text-center px-2 z-10">
            <div className="text-[8px] font-bold text-white uppercase tracking-wide leading-tight">
              {shortName}
            </div>
          </div>
        </div>
      );
  }
}

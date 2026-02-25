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

    await copyToClipboard(galleryUrl);

    if (navigator.share && navigator.canShare?.({ files: [result.file] })) {
      try {
        await navigator.share({ files: [result.file], title: eventName });
        showToast('Link copied! Add a Link Sticker on Instagram');
        setGenerating(false);
        return;
      } catch {
        // cancelled — fall through to download
      }
    }

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
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' } as React.CSSProperties} />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300 overflow-hidden"
        style={{
          borderRadius: '24px 24px 0 0',
          background: 'linear-gradient(160deg, rgba(40,40,55,0.98) 0%, rgba(12,12,18,0.99) 100%)',
          backdropFilter: 'blur(48px) saturate(160%)',
          WebkitBackdropFilter: 'blur(48px) saturate(160%)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 -8px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        } as React.CSSProperties}
      >
        {/* Top highlight line */}
        <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-0.5">Share</p>
            <h3 className="text-[17px] font-bold text-white leading-tight">{eventName}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(10px)',
            } as React.CSSProperties}
            aria-label="Close"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Section label */}
        <p className="px-5 pt-1 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">Style</p>

        {/* Template previews */}
        <div className="px-4 pb-5">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {TEMPLATES.map((tmpl) => {
              const active = selectedTemplate === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 transition-all duration-200"
                  style={{ transform: active ? 'scale(1.05)' : 'scale(1)' }}
                >
                  <div
                    className="w-[128px] h-[228px] rounded-[18px] overflow-hidden transition-all duration-200"
                    style={
                      active
                        ? {
                            border: '2.5px solid rgba(255,255,255,0.9)',
                            boxShadow: '0 0 0 3px rgba(255,255,255,0.1), 0 12px 40px rgba(0,0,0,0.6)',
                          }
                        : {
                            border: '2px solid rgba(255,255,255,0.07)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                            opacity: 0.5,
                          }
                    }
                  >
                    <TemplatePreview template={tmpl.id} photoUrl={photoUrl} eventName={eventName} />
                  </div>
                  <span
                    className="text-[11px] font-semibold transition-colors tracking-wide"
                    style={{ color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)' }}
                  >
                    {tmpl.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 mb-4" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

        {/* Share to label */}
        <p className="px-5 pb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">Share to</p>

        {/* Share target buttons */}
        <div className="px-5 pb-5">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {/* Instagram Stories */}
            <ShareButton
              onClick={handleShareStory}
              disabled={generating}
              label={generating ? 'Creating…' : 'Stories'}
              bg={generating ? 'rgba(255,255,255,0.08)' : undefined}
              gradient={generating ? undefined : 'linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)'}
              glow={generating ? undefined : '0 4px 20px rgba(221,42,123,0.45)'}
            >
              {generating ? (
                <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="white" strokeWidth="2" />
                  <circle cx="12" cy="12" r="5" fill="none" stroke="white" strokeWidth="2" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
                </svg>
              )}
            </ShareButton>

            {/* WhatsApp */}
            <ShareButton
              onClick={handleWhatsApp}
              label="WhatsApp"
              bg="#25d366"
              glow="0 4px 20px rgba(37,211,102,0.4)"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </ShareButton>

            {/* Copy Link */}
            <ShareButton onClick={handleCopyLink} label="Copy link" glass>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </ShareButton>

            {/* More */}
            <ShareButton
              onClick={async () => {
                if (navigator.share) {
                  try { await navigator.share({ title: eventName, url: galleryUrl }); }
                  catch { /* cancelled */ }
                } else {
                  await copyToClipboard(galleryUrl);
                  showToast('Link copied!');
                }
              }}
              label="More"
              glass
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
              </svg>
            </ShareButton>
          </div>
        </div>

        {/* Cancel */}
        <div className="px-5 pb-10">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl text-[15px] font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.6)',
            } as React.CSSProperties}
          >
            Cancel
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="absolute top-[-52px] left-1/2 -translate-x-1/2 bg-white text-gray-900 text-sm font-semibold px-5 py-2 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared share button ──────────────────────────────────────

function ShareButton({
  onClick,
  disabled,
  label,
  children,
  bg,
  gradient,
  glow,
  glass,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  bg?: string;
  gradient?: string;
  glow?: string;
  glass?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 flex-shrink-0 transition-all active:scale-95 disabled:opacity-60"
    >
      <div
        className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center"
        style={{
          background: gradient ?? bg ?? (glass ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)'),
          boxShadow: glow ?? (glass ? 'none' : undefined),
          border: glass ? '1px solid rgba(255,255,255,0.12)' : undefined,
          backdropFilter: glass ? 'blur(10px)' : undefined,
          WebkitBackdropFilter: glass ? 'blur(10px)' : undefined,
        } as React.CSSProperties}
      >
        {children}
      </div>
      <span className="text-[11px] font-medium text-white/50">{label}</span>
    </button>
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
  const shortName = eventName.length > 16 ? eventName.slice(0, 16) + '…' : eventName;

  const imgFill: React.CSSProperties = {
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
          <img src={photoUrl} alt="" style={imgFill} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />
          <div className="absolute bottom-3 left-0 right-0 text-center px-2">
            <div className="text-[8px] font-black text-white uppercase tracking-wider leading-tight drop-shadow">
              {shortName}
            </div>
          </div>
        </div>
      );

    case 'polaroid':
      return (
        <div className="relative w-full h-full bg-gray-700 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" style={{ ...imgFill, filter: 'blur(10px) brightness(0.35)', transform: 'scale(1.4)' }} />
          <div className="relative bg-white rounded-[3px] p-[5px] pb-[16px] w-[74%] shadow-2xl z-10">
            <div className="aspect-square w-full rounded-[2px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="text-[6px] font-black text-gray-800 text-center mt-[7px] uppercase tracking-wider leading-tight">
              {shortName}
            </div>
          </div>
        </div>
      );

    case 'immersive':
      return (
        <div className="relative w-full h-full bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" style={imgFill} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90" />
          <div className="absolute bottom-3 left-0 right-0 text-center px-2">
            <div className="text-[9px] font-black text-white uppercase tracking-wider leading-tight drop-shadow-lg">
              {shortName}
            </div>
          </div>
        </div>
      );

    case 'glass-frame':
      return (
        <div className="relative w-full h-full overflow-hidden bg-black">
          {/* Soft-blurred photo bg — details still visible */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" style={{ ...imgFill, filter: 'blur(6px) brightness(0.42) saturate(1.3)', transform: 'scale(1.2)' }} />
          {/* Light darken overlay */}
          <div className="absolute inset-0 bg-black/20" />
          {/* Glass card */}
          <div className="absolute top-[14px] left-[8px] right-[8px] z-10">
            <div
              className="rounded-[12px] overflow-hidden"
              style={{
                padding: '4px',
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(255,255,255,0.22)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            >
              {/* Natural aspect ratio — 3:2 landscape crop for preview */}
              <div className="w-full rounded-[9px] overflow-hidden" style={{ aspectRatio: '3/2' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
          {/* Name + subtitle */}
          <div className="absolute bottom-3 left-0 right-0 text-center px-2 z-10">
            <div className="text-[8px] font-black text-white uppercase tracking-wider leading-tight drop-shadow">
              {shortName}
            </div>
            <div className="text-[5px] text-white/35 mt-0.5 tracking-wide">PIXTRACE</div>
          </div>
        </div>
      );
  }
}

'use client';

import { useState } from 'react';

interface EventLinkActionsProps {
  galleryUrl: string;
}

export function EventLinkActions({ galleryUrl }: EventLinkActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(galleryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = galleryUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    // Find the QR canvas and download it
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'event-qr-code.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Event Gallery',
          url: galleryUrl,
        });
      } catch {
        // User cancelled share dialog
      }
    } else {
      // Fallback: copy to clipboard
      handleCopyLink();
    }
  };

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 truncate mb-2">{galleryUrl}</p>
      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={handleCopyLink}
          className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={handleDownloadQR}
          className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          Download QR
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={handleShare}
          className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          Share
        </button>
      </div>
    </div>
  );
}

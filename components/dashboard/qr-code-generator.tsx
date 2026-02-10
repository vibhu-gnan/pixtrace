'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export function QRCodeGenerator({
  url,
  eventName,
}: {
  url: string;
  eventName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    }
  }, [url]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="rounded-lg" />
      <p className="text-xs text-gray-500 mt-2 text-center">
        Scan to view gallery
      </p>
      <div className="flex items-center gap-2 mt-3 w-full">
        <button
          onClick={handleCopyLink}
          className="flex-1 text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={handleDownloadQR}
          className="flex-1 text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Download QR
        </button>
      </div>
    </div>
  );
}

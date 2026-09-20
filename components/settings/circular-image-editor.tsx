'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Circular crop / position editor for logo (and similar) marks.
 *
 * Drag to pan, slider to zoom. Exports a square PNG of the circle's
 * contents so the gallery credit's rounded-full <img> shows exactly
 * what was approved here.
 */

const VIEW = 280;
const OUTPUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface CircularImageEditorProps {
  imageSrc: string;
  title?: string;
  onCancel: () => void;
  onApply: (blob: Blob) => void | Promise<void>;
}

export function CircularImageEditor({
  imageSrc,
  title = 'Position your logo',
  onCancel,
  onApply,
}: CircularImageEditorProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      // A vector image with no intrinsic size loads "successfully" at 0x0.
      // Without this guard `ready` goes true, Apply enables, and the export
      // silently no-ops on its own !natural.w check — a dead end with no
      // message. Treat it as a load failure instead.
      if (!img.naturalWidth || !img.naturalHeight) {
        setReady(false);
        setLoadError("That image has no fixed size, so it can't be cropped. Try a PNG, JPEG or WebP.");
        return;
      }
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setLoadError(null);
      setReady(true);
    };
    img.onerror = () => {
      setReady(false);
      setLoadError("That image couldn't be opened. Try a different file.");
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Scale that makes the image cover the circle at zoom=1.
  const coverScale =
    natural.w > 0 && natural.h > 0 ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1;
  const drawScale = coverScale * zoom;

  const clampOffset = useCallback(
    (x: number, y: number, z: number) => {
      if (!natural.w || !natural.h) return { x: 0, y: 0 };
      const s = coverScale * z;
      const drawnW = natural.w * s;
      const drawnH = natural.h * s;
      const maxX = Math.max(0, (drawnW - VIEW) / 2);
      const maxY = Math.max(0, (drawnH - VIEW) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [coverScale, natural.h, natural.w],
  );

  useEffect(() => {
    setOffset((o) => clampOffset(o.x, o.y, zoom));
  }, [zoom, clampOffset]);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy, zoom));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  async function handleApply() {
    const img = imgRef.current;
    if (!img || !natural.w) return;

    setApplying(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      // Map the circular VIEW region onto OUTPUT×OUTPUT.
      const scale = (coverScale * zoom) * (OUTPUT / VIEW);
      const drawnW = natural.w * scale;
      const drawnH = natural.h * scale;
      const dx = (OUTPUT - drawnW) / 2 + offset.x * (OUTPUT / VIEW);
      const dy = (OUTPUT - drawnH) / 2 + offset.y * (OUTPUT / VIEW);

      ctx.clearRect(0, 0, OUTPUT, OUTPUT);
      ctx.drawImage(img, dx, dy, drawnW, drawnH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to export image'))),
          'image/png',
        );
      });
      await onApply(blob);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        disabled={applying}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-crop-title"
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl p-5"
      >
        <h2 id="logo-crop-title" className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Drag to position. Guests see this inside a circle.
        </p>

        {loadError && (
          <p role="alert" className="mt-3 text-sm text-red-600">{loadError}</p>
        )}

        <div className="mt-4 flex justify-center">
          <div
            className="relative touch-none select-none cursor-grab active:cursor-grabbing bg-gray-100"
            style={{
              width: VIEW,
              height: VIEW,
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {ready && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  width: natural.w * drawScale,
                  height: natural.h * drawScale,
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="logo-zoom" className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Zoom</span>
            <span>{zoom.toFixed(1)}×</span>
          </label>
          <input
            id="logo-zoom"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brand-500"
            disabled={!ready || applying}
          />
        </div>

        {/* Live size check — same 56px the credit card uses */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
          <div
            className="w-14 h-14 rounded-full overflow-hidden bg-white border border-gray-200 shrink-0 relative"
            aria-hidden
          >
            {ready && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt=""
                draggable={false}
                className="absolute max-w-none"
                style={{
                  width: natural.w * drawScale * (56 / VIEW),
                  height: natural.h * drawScale * (56 / VIEW),
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${offset.x * (56 / VIEW)}px), calc(-50% + ${offset.y * (56 / VIEW)}px))`,
                }}
              />
            )}
          </div>
          <p className="text-xs text-gray-500">
            Preview at actual size on galleries (56px).
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!ready || applying}
            className="px-4 py-1.5 text-sm rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-60"
          >
            {applying ? 'Saving…' : 'Use this crop'}
          </button>
        </div>
      </div>
    </div>
  );
}

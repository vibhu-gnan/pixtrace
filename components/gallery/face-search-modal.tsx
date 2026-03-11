'use client';

import { useState, useCallback, useRef } from 'react';
import { SelfieCamera } from './selfie-camera';

interface FaceSearchModalProps {
  onSelfieConfirmed: (blob: Blob) => void;
  onClose: () => void;
}

type ModalState = 'capturing' | 'confirming';

/**
 * Lightweight selfie capture modal.
 * Handles camera + confirmation only — search runs in the background after close.
 */
export function FaceSearchModal({
  onSelfieConfirmed,
  onClose,
}: FaceSearchModalProps) {
  const [modalState, setModalState] = useState<ModalState>('capturing');
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieBlobRef = useRef<Blob | null>(null);

  const handleCapture = useCallback((blob: Blob) => {
    selfieBlobRef.current = blob;
    setSelfiePreview(URL.createObjectURL(blob));
    setModalState('confirming');
  }, []);

  const handleConfirm = useCallback(() => {
    if (selfieBlobRef.current) {
      onSelfieConfirmed(selfieBlobRef.current);
      // Parent will close the modal and start the background search
    }
  }, [onSelfieConfirmed]);

  const handleRetake = useCallback(() => {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfiePreview(null);
    selfieBlobRef.current = null;
    setModalState('capturing');
  }, [selfiePreview]);

  const handleClose = useCallback(() => {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfiePreview(null);
    selfieBlobRef.current = null;
    onClose();
  }, [selfiePreview, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl animate-in slide-in-from-bottom duration-300"
        style={{
          background: 'linear-gradient(160deg, rgba(40,40,55,0.98), rgba(12,12,18,0.99))',
          backdropFilter: 'blur(48px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-semibold text-white">Find Your Photos</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-8">
          {/* CAPTURE state */}
          {modalState === 'capturing' && (
            <SelfieCamera onCapture={handleCapture} onClose={handleClose} />
          )}

          {/* CONFIRM state */}
          {modalState === 'confirming' && selfiePreview && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-[320px] aspect-[3/4] rounded-2xl overflow-hidden">
                <img src={selfiePreview} alt="Your selfie" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-3 w-full max-w-[320px]">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  Retake
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
                  }}
                >
                  Find My Photos
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

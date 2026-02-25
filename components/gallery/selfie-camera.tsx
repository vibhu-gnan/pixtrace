'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface SelfieCameraProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export function SelfieCamera({ onCapture, onClose }: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Unable to access camera. Please try again.');
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    // Mirror the capture to match the preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera();
          onCapture(blob);
        }
      },
      'image/jpeg',
      0.85,
    );
  }, [onCapture, stopCamera]);

  // Fallback: file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      stopCamera();
      onCapture(file);
    }
  }, [onCapture, stopCamera]);

  return (
    <div className="flex flex-col items-center gap-4">
      {cameraError ? (
        <div className="text-center py-8">
          <div className="text-sm text-gray-400 mb-4">{cameraError}</div>
          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.12)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            Upload a Selfie
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      ) : (
        <>
          {/* Camera viewfinder */}
          <div className="relative w-full max-w-[320px] aspect-[3/4] rounded-2xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
            )}
            {/* Face guide oval */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[200px] h-[260px] border-2 border-white/30 rounded-full" />
            </div>
          </div>

          {/* Tips */}
          <p className="text-xs text-gray-400 text-center">
            Position your face within the oval in good lighting
          </p>

          {/* Capture button */}
          <div className="flex items-center gap-4">
            <button
              onClick={captureFrame}
              disabled={!cameraReady}
              className="w-16 h-16 rounded-full border-4 border-white/80 flex items-center justify-center disabled:opacity-40 transition-opacity"
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
          </div>

          {/* Upload fallback */}
          <label className="text-xs text-gray-500 underline cursor-pointer">
            Or upload a photo
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileUpload} />
          </label>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

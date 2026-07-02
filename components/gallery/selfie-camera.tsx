'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface SelfieCameraProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// iOS in-app webviews (WhatsApp, Instagram, Facebook, etc.) block getUserMedia
// entirely — the live camera can never work there, only the upload fallback.
function detectInAppBrowser(): boolean {
  if (!detectIOS()) return false;
  const ua = navigator.userAgent || '';
  // Real Safari UA contains "Safari" and "Version/"; in-app webviews omit these
  // or add an app token (FBAN/FBAV/Instagram/Line/etc.).
  const inAppToken = /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|Snapchat|LinkedIn|MicroMessenger|GSA)/i.test(ua);
  const isRealSafari = /Safari/.test(ua) && /Version\//.test(ua);
  return inAppToken || !isRealSafari;
}

type Phase = 'idle' | 'live' | 'error';

export function SelfieCamera({ onCapture, onClose }: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // IMPORTANT: iOS Safari only shows the camera permission prompt when
  // getUserMedia is called from a direct user gesture. Calling it on mount
  // (no gesture) makes iOS silently reject with NotAllowedError and never
  // prompt. So on iOS we wait for an explicit "Enable Camera" tap; other
  // platforms can auto-start on mount for a smoother flow.
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      setPhase('live');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setDenied(true);
        setCameraError('Camera access is blocked for this site.');
      } else if (err?.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Unable to start the camera. Please try again.');
      }
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    const ios = detectIOS();
    setIsIOS(ios);
    setIsInApp(detectInAppBrowser());
    // Auto-start only where a gesture isn't required (non-iOS). iOS waits
    // for the user to tap "Enable Camera".
    if (!ios) startCamera();
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

  // Fallback: file upload (Photo Library on iOS — no capture attribute so the
  // user can pick an existing selfie without the camera).
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      stopCamera();
      onCapture(file);
    }
  }, [onCapture, stopCamera]);

  const uploadInput = (
    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
  );

  return (
    <div className="flex flex-col items-center gap-4">
      {/* IDLE — waiting for the user to enable the camera (iOS gesture) */}
      {phase === 'idle' && (
        <div className="text-center py-8">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <p className="text-sm text-gray-300 mb-1">Take a quick selfie to find your photos</p>
          <p className="text-xs text-gray-500 mb-5">We&apos;ll ask for camera access next</p>
          <button
            onClick={startCamera}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
            }}
          >
            Enable Camera
          </button>
          <label className="block mt-4 text-xs text-gray-500 underline cursor-pointer">
            Or upload a photo
            {uploadInput}
          </label>
        </div>
      )}

      {/* ERROR — camera couldn't start */}
      {phase === 'error' && (
        <div className="text-center py-8">
          <div className="text-sm text-gray-300 mb-2">{cameraError}</div>

          {denied && isIOS && !isInApp && (
            <div className="text-xs text-gray-400 mb-4 px-2 text-left inline-block max-w-[320px]">
              To turn it on: tap the <span className="text-white font-medium">&ldquo;ᴀA&rdquo;</span> icon
              in the address bar → <span className="text-white font-medium">Website Settings</span> →
              <span className="text-white font-medium"> Camera → Allow</span>, then reload.
              <br className="mb-1" />
              Still blocked? Check <span className="text-white font-medium">Settings → Screen Time →
              Content &amp; Privacy Restrictions → Camera</span> is allowed.
            </div>
          )}

          {isInApp && (
            <div className="text-xs text-amber-300/80 mb-4 px-4">
              You&apos;re viewing this inside another app. For the live camera, tap the
              &nbsp;•••&nbsp; menu and choose &ldquo;Open in Safari&rdquo;.
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            {!isInApp && (
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
                }}
              >
                Try Camera Again
              </button>
            )}
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Upload a Selfie Instead
              {uploadInput}
            </label>
          </div>
        </div>
      )}

      {/* LIVE — camera viewfinder */}
      {phase === 'live' && (
        <>
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

          <p className="text-xs text-gray-400 text-center">
            Position your face within the oval in good lighting
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={captureFrame}
              disabled={!cameraReady}
              className="w-16 h-16 rounded-full border-4 border-white/80 flex items-center justify-center disabled:opacity-40 transition-opacity"
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
          </div>

          <label className="text-xs text-gray-500 underline cursor-pointer">
            Or upload a photo
            {uploadInput}
          </label>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

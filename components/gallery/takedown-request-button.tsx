'use client';

import { useState, useTransition } from 'react';
import { useGalleryAuth } from '@/lib/auth/use-gallery-auth';
import { requestTakedown } from '@/actions/takedowns';

/**
 * Lets a guest ask for a photo of themselves to be taken down. The photo hides
 * immediately and returns by itself within six hours unless the organizer acts, so the
 * confirm step is intentionally light — this is reversible.
 *
 * Requests require a signed-in visitor: it keeps them accountable and rate-limitable,
 * which is what stops anyone holding the gallery link from hiding photos at will.
 */
export function TakedownRequestButton({
  eventHash,
  mediaId,
}: {
  eventHash: string;
  mediaId: string;
}) {
  const { user, accessToken, signInWithGoogle } = useGalleryAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!accessToken) return;
    setError(null);
    startTransition(async () => {
      const result = await requestTakedown({ eventHash, mediaId, reason, accessToken });
      if (result.error) setError(result.error);
      else setDone(true);
    });
  };

  const close = () => {
    setOpen(false);
    setReason('');
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => (done ? undefined : setOpen(true))}
        disabled={done}
        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-60 flex items-center justify-center transition-colors"
        aria-label="Request removal of this photo"
        title={done ? 'Removal requested' : 'Request removal'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          {done ? <polyline points="20 6 9 17 4 12" /> : (
            <>
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </>
          )}
        </svg>
      </button>

      {open && !done && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6"
            style={{
              background: 'linear-gradient(160deg, rgba(40,40,55,0.98), rgba(12,12,18,0.99))',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h2 className="text-lg font-semibold text-white">Request removal</h2>

            {user ? (
              <>
                <p className="mt-1 text-sm text-white/60 leading-relaxed">
                  This photo will be hidden straight away and the organiser will be asked to
                  review it. If they do not respond, it comes back within 6 hours.
                </p>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Reason (optional) — this helps the organiser decide"
                  className="mt-4 w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30 resize-none"
                />

                {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={close}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={pending}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-70 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                  >
                    {pending ? 'Sending…' : 'Request removal'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-white/60 leading-relaxed">
                  Please sign in first. We ask for this so the organiser knows the request is
                  genuine.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={close}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => signInWithGoogle(window.location.href)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-black bg-white hover:bg-white/90 transition-colors"
                  >
                    Sign in
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {done && (
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white bg-black/70 px-2 py-1 rounded whitespace-nowrap">
          Removal requested
        </span>
      )}
    </>
  );
}

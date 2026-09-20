'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { OrganizerProfile } from '@/lib/auth/session';
import { updateCreditProfile } from '@/actions/settings';
import { CreditCard } from '@/components/gallery/credit-card';
import { buildCredit } from '@/lib/credit/types';
import {
  sanitizeInstagram,
  sanitizeWebsite,
  sanitizeWhatsApp,
  sanitizePublicEmail,
} from '@/lib/validation/contact';
import { CircularImageEditor } from '@/components/settings/circular-image-editor';

/**
 * Branding settings — the photographer's public credit.
 *
 * The preview on the right is the real <CreditCard>, the same component the
 * gallery footer renders. A hand-built mock would drift, and this is the one
 * screen where the photographer is approving how their brand appears to
 * thousands of strangers.
 *
 * Conventions follow profile-form.tsx: plain useState, inline errors (never
 * alert()), hasChanges diffing, 3s success auto-clear.
 */

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Country codes worth surfacing. India first — it is the primary market. */
const DIAL_CODES = [
  { code: '91', label: '🇮🇳 +91' },
  { code: '1', label: '🇺🇸 +1' },
  { code: '44', label: '🇬🇧 +44' },
  { code: '971', label: '🇦🇪 +971' },
  { code: '61', label: '🇦🇺 +61' },
  { code: '65', label: '🇸🇬 +65' },
];

/** Split a stored digits-only number back into dial code + local part. */
function splitWhatsApp(stored: string | null): { dial: string; local: string } {
  if (!stored) return { dial: '91', local: '' };
  const match = DIAL_CODES
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find((d) => stored.startsWith(d.code));
  return match
    ? { dial: match.code, local: stored.slice(match.code.length) }
    : { dial: '91', local: stored };
}

interface BrandingFormProps {
  organizer: OrganizerProfile;
  /** Server-resolved signed URL for an already-saved logo. */
  initialLogoUrl: string | null;
}

export function BrandingForm({ organizer, initialLogoUrl }: BrandingFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialPhone = useMemo(() => splitWhatsApp(organizer.credit_whatsapp), [organizer.credit_whatsapp]);

  const [displayName, setDisplayName] = useState(organizer.credit_display_name || organizer.business_name || '');
  const [tagline, setTagline] = useState(organizer.credit_tagline || '');
  const [dial, setDial] = useState(initialPhone.dial);
  const [waLocal, setWaLocal] = useState(initialPhone.local);
  const [instagram, setInstagram] = useState(organizer.credit_instagram || '');
  const [website, setWebsite] = useState(organizer.credit_website || '');
  const [publicEmail, setPublicEmail] = useState(organizer.credit_public_email || '');
  const [logoKey, setLogoKey] = useState(organizer.credit_logo_url || '');
  const [enabled, setEnabled] = useState(organizer.credit_enabled);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  /** Local object URL opened in the circular crop editor before upload. */
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  useEffect(() => {
    return () => { if (cropSrc) URL.revokeObjectURL(cropSrc); };
  }, [cropSrc]);

  // Normalised values — what will actually be stored. The preview renders from
  // these, not the raw input, so a pasted Instagram URL shows as the handle it
  // will become rather than as the thing the user typed.
  const cleanWhatsApp = sanitizeWhatsApp(waLocal ? `${dial}${waLocal.replace(/\D/g, '')}` : null);
  const cleanInstagram = sanitizeInstagram(instagram);
  const cleanWebsite = sanitizeWebsite(website);
  const cleanEmail = sanitizePublicEmail(publicEmail);

  const channelCount = [cleanWhatsApp, cleanInstagram, cleanWebsite, cleanEmail].filter(Boolean).length;
  const canEnable = Boolean(displayName.trim()) && channelCount > 0;

  const previewCredit = buildCredit(
    {
      displayName: displayName.trim() || null,
      tagline: tagline.trim() || null,
      whatsapp: cleanWhatsApp,
      instagram: cleanInstagram,
      website: cleanWebsite,
      publicEmail: cleanEmail,
    },
    'Riya & Arjun',      // a stand-in event name, so the WhatsApp prefill reads naturally
    { logoUrl: logoPreview || initialLogoUrl, showPoweredBy: true },
  );

  const hasChanges =
    displayName !== (organizer.credit_display_name || organizer.business_name || '') ||
    tagline !== (organizer.credit_tagline || '') ||
    (cleanWhatsApp || '') !== (organizer.credit_whatsapp || '') ||
    (cleanInstagram || '') !== (organizer.credit_instagram || '') ||
    (cleanWebsite || '') !== (organizer.credit_website || '') ||
    (cleanEmail || '') !== (organizer.credit_public_email || '') ||
    logoKey !== (organizer.credit_logo_url || '') ||
    enabled !== organizer.credit_enabled;

  // If the last channel is removed, the credit can no longer be shown — reflect
  // that immediately rather than letting the server reject the save.
  useEffect(() => {
    if (enabled && !canEnable) setEnabled(false);
  }, [enabled, canEnable]);

  const handleLogoPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    // `accept` on the input is only a hint — the OS picker lets people choose
    // "All files". SVG in particular loads at 0x0 and would dead-end in the
    // cropper, so name it explicitly rather than failing later.
    if (file.type === 'image/svg+xml') {
      setError('SVG logos are not supported. Please export a PNG, JPEG or WebP.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPEG, PNG or WebP).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must be under 2MB.');
      return;
    }

    setError(null);
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const closeCropper = useCallback(() => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleCropApply = useCallback(async (blob: Blob) => {
    setUploading(true);
    setError(null);
    try {
      const file = new File([blob], 'logo.png', { type: 'image/png' });
      if (file.size > MAX_LOGO_BYTES) {
        throw new Error('Cropped logo is over 2MB — try a smaller image.');
      }
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload/branding', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      const { key } = await res.json();

      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(URL.createObjectURL(blob));
      setLogoKey(key);
      closeCropper();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [logoPreview, closeCropper]);

  function removeLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setLogoKey('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateCreditProfile({
        enabled,
        displayName: displayName.trim() || null,
        tagline: tagline.trim() || null,
        logoKey: logoKey || null,
        whatsapp: cleanWhatsApp,
        instagram: cleanInstagram,
        website: cleanWebsite,
        publicEmail: cleanEmail,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';
  const label = 'block text-sm font-medium text-gray-700 mb-1';
  const hint = 'mt-1 text-xs text-gray-500';

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Form ─────────────────────────────────────────── */}
      <div className="space-y-5 min-w-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Your details on galleries</h2>
          <p className="mt-1 text-sm text-gray-600">
            Shown at the bottom of every gallery you share, so guests can find and book you.
          </p>
        </div>

        {/* Logo */}
        <div>
          <span className={label}>Logo</span>
          <div className="flex items-center gap-4">
            {logoPreview || initialLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview || initialLogoUrl || ''}
                alt="Your logo"
                className="w-14 h-14 rounded-full object-cover bg-gray-100 border border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 border border-dashed border-gray-300" />
            )}
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : logoKey ? 'Change' : 'Upload logo'}
                </button>
                {logoKey && (
                  <button type="button" onClick={removeLogo} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:bg-gray-100">
                    Remove
                  </button>
                )}
              </div>
              {/* Shown at true render size on purpose — a logo that reads at
                  400px often turns to mush at 56. */}
              <span className="text-xs text-gray-500">Shown at 56px. You can drag to position after picking. JPEG, PNG or WebP, under 2MB.</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleLogoPick}
            className="hidden"
          />
        </div>

        {cropSrc && (
          <CircularImageEditor
            imageSrc={cropSrc}
            onCancel={closeCropper}
            onApply={handleCropApply}
          />
        )}

        <div>
          <label htmlFor="credit-name" className={label}>Studio or display name</label>
          <input id="credit-name" type="text" value={displayName} maxLength={80}
                 onChange={(e) => setDisplayName(e.target.value)}
                 placeholder="Aarav Studio" className={field} />
        </div>

        <div>
          <label htmlFor="credit-tagline" className={label}>
            Tagline <span className="font-normal text-gray-400">· optional</span>
          </label>
          <input id="credit-tagline" type="text" value={tagline} maxLength={120}
                 onChange={(e) => setTagline(e.target.value)}
                 placeholder="Wedding &amp; candid · Bengaluru" className={field} />
          <p className={hint}>{tagline.length}/120</p>
        </div>

        <hr className="border-gray-100" />
        <p className="text-sm font-medium text-gray-700">How guests reach you</p>

        {/* WhatsApp */}
        <div>
          <label htmlFor="credit-wa" className={label}>WhatsApp</label>
          <div className="flex gap-2">
            <select value={dial} onChange={(e) => setDial(e.target.value)}
                    aria-label="Country code"
                    className="rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white">
              {DIAL_CODES.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
            <input id="credit-wa" type="tel" inputMode="numeric" value={waLocal}
                   onChange={(e) => setWaLocal(e.target.value)}
                   placeholder="98765 43210" className={field} />
          </div>
          {/* A wrong number here is invisible until a lead is lost, so make it
              testable in one tap rather than on faith. */}
          {cleanWhatsApp ? (
            <p className={hint}>
              Opens{' '}
              <a href={`https://wa.me/${cleanWhatsApp}`} target="_blank" rel="noopener noreferrer"
                 className="text-brand-600 underline">
                wa.me/{cleanWhatsApp}
              </a>{' '}
              — tap to test it.
            </p>
          ) : waLocal ? (
            <p className="mt-1 text-xs text-amber-600">That doesn&apos;t look like a complete number yet.</p>
          ) : (
            <p className={hint}>Guests get a prefilled message, so they don&apos;t have to work out what to say.</p>
          )}
        </div>

        {/* Instagram */}
        <div>
          <label htmlFor="credit-ig" className={label}>Instagram</label>
          <input id="credit-ig" type="text" value={instagram}
                 onChange={(e) => setInstagram(e.target.value)}
                 placeholder="@aaravstudio" className={field} />
          {cleanInstagram ? (
            <p className={hint}>instagram.com/{cleanInstagram}</p>
          ) : instagram ? (
            <p className="mt-1 text-xs text-amber-600">Letters, numbers, dots and underscores only.</p>
          ) : (
            <p className={hint}>Paste a handle or a profile link — either works.</p>
          )}
        </div>

        {/* Website */}
        <div>
          <label htmlFor="credit-web" className={label}>Website</label>
          <input id="credit-web" type="text" value={website}
                 onChange={(e) => setWebsite(e.target.value)}
                 placeholder="aaravstudio.com" className={field} />
          {cleanWebsite ? (
            <p className={hint}>{cleanWebsite}</p>
          ) : website ? (
            <p className="mt-1 text-xs text-amber-600">Must be a secure (https) address.</p>
          ) : null}
        </div>

        {/* Public email */}
        <div>
          <label htmlFor="credit-email" className={label}>Business email</label>
          <input id="credit-email" type="email" value={publicEmail}
                 onChange={(e) => setPublicEmail(e.target.value)}
                 placeholder="hello@aaravstudio.com" className={field} />
          {publicEmail.trim().toLowerCase() === organizer.email.toLowerCase() ? (
            <p className="mt-1 text-xs text-amber-600">
              That&apos;s your account email. Consider a separate business address — this one goes public.
            </p>
          ) : (
            <p className={hint}>Kept separate from your login email, which is never shown.</p>
          )}
        </div>

        {/* ── Publish gate ───────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canEnable}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 disabled:opacity-40"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">Show my details on my galleries</span>
              <span className="block text-xs text-gray-600 mt-0.5">
                Anyone with a gallery link can see this. Use a business number and a business email —
                not personal ones.
              </span>
            </span>
          </label>
          {!canEnable && (
            <p className="mt-2 text-xs text-gray-500 pl-7">
              Add a name and at least one way to reach you first.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Saved. Galleries update within an hour.</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || !hasChanges}
                  className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save branding'}
          </button>
          <span className="text-xs text-gray-500">Changes appear on galleries within an hour.</span>
        </div>
      </div>

      {/* ── Live preview ─────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 h-fit">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          What guests see
        </p>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          {previewCredit ? (
            <>
              <CreditCard credit={previewCredit} preview />
              <p className="mt-6 text-center text-xs text-gray-500">Powered by PIXTRACE</p>
              {!enabled && (
                <p className="mt-4 text-center text-xs text-amber-600">
                  Not showing yet — tick the box to publish.
                </p>
              )}
            </>
          ) : (
            // An empty state that shows the path rather than making them find it.
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 border border-dashed border-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Your credit isn&apos;t ready yet</p>
              <ul className="mt-3 text-xs text-gray-500 space-y-1 text-left inline-block">
                <li>{displayName.trim() ? '✓' : '○'} Add a studio name</li>
                <li>{channelCount > 0 ? '✓' : '○'} Add one way to reach you</li>
                <li>{enabled ? '✓' : '○'} Turn it on</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

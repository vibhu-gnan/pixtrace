'use client';

import { useState } from 'react';
import { creditMonogram, type PhotographerCredit, type CreditChannel } from '@/lib/credit/types';

/**
 * The photographer's credit, as guests see it.
 *
 * Presentational and pure: it takes a resolved credit and renders it. The same
 * component backs the gallery footer and the live preview in Branding settings,
 * so what the photographer approves is literally what ships.
 *
 * Accessibility and contrast notes are inline where the value looks arbitrary —
 * several of these numbers are the difference between passing WCAG AA and not.
 */

interface CreditCardProps {
  credit: PhotographerCredit;
  /** Fires before navigation, for click attribution. Must not block the link. */
  onChannelClick?: (channel: CreditChannel) => void;
  /** `compact` is the in-gallery placement; `full` is the footer. */
  variant?: 'full' | 'compact';
  /** Disables navigation. Used by the settings preview. */
  preview?: boolean;
}

// #25D366 is WhatsApp's brand green. Paired with WHITE text it is 1.98:1 and
// fails WCAG AA outright — which is what most implementations ship. Paired with
// near-black (#111827) it is 9.5:1 and passes AAA, while staying instantly
// recognisable. Do not "fix" this to white text.
const WHATSAPP_BG = '#25D366';
const WHATSAPP_FG = '#111827';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.36.101 11.944c0 2.105.549 4.16 1.595 5.973L0 24l6.305-1.654a11.9 11.9 0 0 0 5.71 1.454h.006c6.585 0 11.946-5.36 11.949-11.945A11.9 11.9 0 0 0 20.52 3.45" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.668-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0m0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

export function CreditCard({ credit, onChannelClick, variant = 'full', preview = false }: CreditCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(credit.logoUrl) && !logoFailed;
  const compact = variant === 'compact';

  // Secondary channels. Each gets a visible text label, not an icon alone: a
  // globe beside an Instagram glyph is not guessable, and guests are on a phone
  // in a hurry. 48x48 is the WCAG 2.5.5 / Material / HIG touch-target floor.
  const secondary = [
    credit.instagramUrl && { key: 'instagram' as const, href: credit.instagramUrl, label: 'Instagram', Icon: InstagramIcon, aria: 'Open Instagram profile (opens in a new tab)' },
    credit.websiteUrl && { key: 'website' as const, href: credit.websiteUrl, label: 'Website', Icon: GlobeIcon, aria: 'Open website (opens in a new tab)' },
    credit.emailUrl && { key: 'email' as const, href: credit.emailUrl, label: 'Email', Icon: MailIcon, aria: `Email ${credit.displayName}` },
  ].filter(Boolean) as Array<{ key: CreditChannel; href: string; label: string; Icon: typeof MailIcon; aria: string }>;

  const linkProps = (channel: CreditChannel, external: boolean) => ({
    onClick: (e: React.MouseEvent) => {
      if (preview) { e.preventDefault(); return; }
      // Deliberately not awaited and never preventDefault'd — the beacon must
      // not stand between the guest and the thing they tapped.
      onChannelClick?.(channel);
    },
    ...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {}),
  });

  return (
    <div className={compact ? 'text-center' : 'max-w-md mx-auto text-center'}>
      {/* Identity */}
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={credit.logoUrl!}
          alt=""
          onError={() => setLogoFailed(true)}
          className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} mx-auto rounded-full object-cover bg-gray-100`}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`${compact ? 'w-10 h-10 text-base' : 'w-14 h-14 text-xl'} mx-auto rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold`}
        >
          {creditMonogram(credit.displayName)}
        </div>
      )}

      <p className={`${compact ? 'mt-2 text-sm' : 'mt-3 text-lg'} font-semibold text-gray-900`}>
        Photos by {credit.displayName}
      </p>
      {credit.tagline && (
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 mt-0.5 truncate`}>
          {credit.tagline}
        </p>
      )}

      {/* Primary CTA — exactly one filled button. Two competing CTAs halve the
          click rate on both, so the other channels stay visually secondary. */}
      {credit.whatsappUrl && (
        <a
          href={credit.whatsappUrl}
          {...linkProps('whatsapp', true)}
          style={{ backgroundColor: WHATSAPP_BG, color: WHATSAPP_FG }}
          className={`${compact ? 'mt-3 h-11' : 'mt-5 h-12'} w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 font-semibold
                      transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900`}
        >
          <WhatsAppIcon className="w-5 h-5" />
          Message on WhatsApp
        </a>
      )}

      {secondary.length > 0 && (
        <ul className={`${compact ? 'mt-3' : 'mt-5'} flex items-start justify-center gap-3 list-none p-0`}>
          {secondary.map(({ key, href, label, Icon, aria }) => (
            <li key={key}>
              <a
                href={href}
                aria-label={aria}
                {...linkProps(key, key !== 'email')}
                className="flex flex-col items-center gap-1 group"
              >
                {/* 48x48 exactly — not a 32px icon with padding. */}
                <span className="w-12 h-12 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center
                                 group-hover:bg-gray-200 transition-colors
                                 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-gray-900">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-[11px] text-gray-600">{label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

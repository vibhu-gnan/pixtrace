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
 * Tone, deliberately: guests came to find their photos, not to hire anyone.
 * The credit should be findable and legible, never louder than the photographs
 * above it. So there is no saturated full-width bar — every channel is the same
 * size of quiet pill, and WhatsApp is distinguished by a tint and a reason to
 * tap ("Book VP Studio for your event") rather than by volume.
 */

interface CreditCardProps {
  credit: PhotographerCredit;
  /** Fires before navigation, for click attribution. Must not block the link. */
  onChannelClick?: (channel: CreditChannel) => void;
  /** `row` puts identity and actions side by side on wide screens (the footer);
   *  `stack` keeps them centred in one column (the settings preview). */
  layout?: 'row' | 'stack';
  /** Disables navigation. Used by the settings preview. */
  preview?: boolean;
}

// Tinted rather than solid. Text #0B5D32 on #E8F7EE is 7.3:1 (AAA), and on the
// white page around it the pill reads as "a WhatsApp link", not as an alarm.
const WA_BG = '#E8F7EE';
const WA_BORDER = '#9FDDB6';
const WA_FG = '#0B5D32';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.36.101 11.944c0 2.105.549 4.16 1.595 5.973L0 24l6.305-1.654a11.9 11.9 0 0 0 5.71 1.454h.006c6.585 0 11.946-5.36 11.949-11.945A11.9 11.9 0 0 0 20.52 3.45" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
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

/** "https://www.vpstudio.in/about" → "vpstudio.in" — a link that reads as a link. */
function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Website';
  }
}

export function CreditCard({ credit, onChannelClick, layout = 'stack', preview = false }: CreditCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(credit.logoUrl) && !logoFailed;
  const row = layout === 'row';

  const linkProps = (channel: CreditChannel, external: boolean) => ({
    onClick: (e: React.MouseEvent) => {
      if (preview) { e.preventDefault(); return; }
      // Deliberately not awaited and never preventDefault'd — the beacon must
      // not stand between the guest and the thing they tapped.
      onChannelClick?.(channel);
    },
    ...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {}),
  });

  // One size for every channel. The previous design put a full-width saturated
  // bar next to lone grey icons, which read as "one real button and some
  // leftovers". Equal pills, each labelled with what it actually opens.
  const pill =
    'inline-flex items-center gap-2 h-11 px-4 rounded-full border text-sm font-medium ' +
    'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 ' +
    'max-w-full';
  const neutral = `${pill} border-gray-300 bg-white text-gray-800 hover:bg-gray-50 hover:border-gray-400`;

  return (
    <div
      className={
        row
          ? 'flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-10 text-center md:text-left'
          : 'flex flex-col items-center gap-5 text-center'
      }
    >
      {/* Identity */}
      <div className={row ? 'flex flex-col md:flex-row items-center gap-4 min-w-0' : 'flex flex-col items-center gap-3'}>
        {showLogo ? (
          // 72px: at the old 56px, a logo with a script and small type under it
          // rendered as a dark circle with unreadable marks.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={credit.logoUrl!}
            alt={`${credit.displayName} logo`}
            onError={() => setLogoFailed(true)}
            className="w-[72px] h-[72px] shrink-0 rounded-full object-cover bg-gray-100 ring-1 ring-gray-200"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-[72px] h-[72px] shrink-0 rounded-full bg-gray-900 text-white flex items-center justify-center text-2xl font-semibold"
          >
            {creditMonogram(credit.displayName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-gray-500">Photographed by</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900 break-words">{credit.displayName}</p>
          {credit.tagline && (
            <p className="mt-0.5 text-sm text-gray-600 break-words">{credit.tagline}</p>
          )}
        </div>
      </div>

      {/* Channels */}
      <ul className={`flex flex-wrap gap-2.5 list-none p-0 m-0 ${row ? 'justify-center md:justify-end' : 'justify-center'}`}>
        {credit.whatsappUrl && (
          <li className="max-w-full">
            <a
              href={credit.whatsappUrl}
              {...linkProps('whatsapp', true)}
              style={{ backgroundColor: WA_BG, borderColor: WA_BORDER, color: WA_FG }}
              className={`${pill} hover:brightness-[0.97]`}
              aria-label={`Book ${credit.displayName} for your event on WhatsApp (opens in a new tab)`}
            >
              <WhatsAppIcon className="w-4 h-4 shrink-0" />
              {/* A reason to tap, not just a channel name. */}
              <span className="truncate">Book {credit.displayName} for your event</span>
            </a>
          </li>
        )}
        {credit.instagramUrl && (
          <li className="max-w-full">
            <a
              href={credit.instagramUrl}
              {...linkProps('instagram', true)}
              className={neutral}
              aria-label={`${credit.displayName} on Instagram, @${credit.instagramHandle} (opens in a new tab)`}
            >
              <InstagramIcon className="w-4 h-4 shrink-0" />
              {/* The handle itself, so it reads as a real profile link. */}
              <span className="truncate">@{credit.instagramHandle}</span>
            </a>
          </li>
        )}
        {credit.websiteUrl && (
          <li className="max-w-full">
            <a
              href={credit.websiteUrl}
              {...linkProps('website', true)}
              className={neutral}
              aria-label={`${credit.displayName} website (opens in a new tab)`}
            >
              <GlobeIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{displayHost(credit.websiteUrl)}</span>
            </a>
          </li>
        )}
        {credit.emailUrl && (
          <li className="max-w-full">
            <a
              href={credit.emailUrl}
              {...linkProps('email', false)}
              className={neutral}
              aria-label={`Email ${credit.displayName}`}
            >
              <MailIcon className="w-4 h-4 shrink-0" />
              <span>Email</span>
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

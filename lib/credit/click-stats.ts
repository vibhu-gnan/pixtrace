import { createAdminClient } from '@/lib/supabase/admin';
import type { CreditChannel } from '@/lib/credit/types';

/**
 * Credit tap counts for one event.
 *
 * A separate query rather than a column on `events`, because the counts live in
 * their own RLS-protected table — see the migration for why putting them on
 * `events` would publish a photographer's enquiry volume to anyone with the
 * anon key.
 *
 * Never throws: a stats panel must not be able to take down the settings page.
 */
export interface CreditClickStats {
  total: number;
  byChannel: Partial<Record<CreditChannel, number>>;
}

const EMPTY: CreditClickStats = { total: 0, byChannel: {} };

export async function getCreditClickStats(eventId: string): Promise<CreditClickStats> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('credit_click_counts')
      .select('channel, count')
      .eq('event_id', eventId);

    if (error || !data) return EMPTY;

    const byChannel: Partial<Record<CreditChannel, number>> = {};
    let total = 0;
    for (const row of data as Array<{ channel: CreditChannel; count: number }>) {
      const n = Number(row.count) || 0;
      byChannel[row.channel] = n;
      total += n;
    }
    return { total, byChannel };
  } catch (err) {
    console.error('[credit] click stats failed:', err);
    return EMPTY;
  }
}

/** "32 WhatsApp · 9 Instagram" — omits channels with no taps. */
export function formatChannelBreakdown(stats: CreditClickStats): string | null {
  const labels: Record<CreditChannel, string> = {
    whatsapp: 'WhatsApp', instagram: 'Instagram', website: 'Website',
    email: 'Email', profile: 'Profile',
  };
  const parts = (Object.entries(stats.byChannel) as Array<[CreditChannel, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([ch, n]) => `${n} ${labels[ch]}`);
  return parts.length ? parts.join(' · ') : null;
}

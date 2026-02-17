'use server';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

export type LogoDisplay = 'cover_and_loading' | 'loading_only' | 'none';

export interface GalleryTheme {
    logoUrl: string | null;
    logoDisplay: LogoDisplay;
    customPreloader: string | null;
}

const FALLBACK: GalleryTheme = { logoUrl: null, logoDisplay: 'none', customPreloader: null };

/**
 * Lightweight query to fetch ONLY logo/theme data for the gallery loading screen.
 * Used by the layout (before the heavy page fetch) so the loading screen can show
 * a branded logo animation instead of a white screen.
 *
 * - Single column select on indexed `event_hash` → sub-10ms
 * - Never throws — always returns a safe fallback
 * - Cached with React `cache()` to deduplicate within the same request
 */
export const getGalleryTheme = cache(async (eventHash: string): Promise<GalleryTheme> => {
    try {
        if (!eventHash || eventHash.length > 32) return FALLBACK;

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('events')
            .select('theme')
            .eq('event_hash', eventHash)
            .eq('is_public', true)
            .single();

        if (error || !data) return FALLBACK;

        const theme = data.theme as Record<string, unknown> | null;
        if (!theme) return FALLBACK;

        const logoUrl = typeof theme.logoUrl === 'string' ? theme.logoUrl : null;
        const rawDisplay = theme.logoDisplay;

        // Validate logoDisplay — only accept known values
        let logoDisplay: LogoDisplay = 'cover_and_loading'; // default for backward compat
        if (rawDisplay === 'loading_only' || rawDisplay === 'none') {
            logoDisplay = rawDisplay;
        } else if (rawDisplay === 'cover_and_loading') {
            logoDisplay = 'cover_and_loading';
        }
        // If no logoUrl, force 'none' regardless of setting
        if (!logoUrl) {
            logoDisplay = 'none';
        }

        // Extract custom preloader HTML (max 50KB guard)
        const rawPreloader = typeof theme.customPreloader === 'string' ? theme.customPreloader : null;
        const customPreloader = rawPreloader && rawPreloader.length <= 51200 ? rawPreloader : null;

        return { logoUrl, logoDisplay, customPreloader };
    } catch {
        // Network error, Supabase down, etc. — never block the loading screen
        return FALLBACK;
    }
});

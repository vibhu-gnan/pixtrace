import { deleteObjects } from './r2-client';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Delete R2 objects with orphan tracking.
 *
 * If R2 deletion fails, the keys are logged to the r2_orphaned_keys table
 * so the cleanup script can retry them later. This prevents permanent
 * orphaned files when R2 is temporarily unavailable.
 *
 * Fire-and-forget: callers don't need to await this. DB is the source of truth.
 */
export function deleteR2WithTracking(
  r2Keys: string[],
  source: 'event_delete' | 'album_delete' | 'media_delete' | 'multi_media_delete' | 'storage_cleanup',
): void {
  if (r2Keys.length === 0) return;

  deleteObjects(r2Keys).catch(async (err) => {
    console.error(`[R2 Cleanup] Failed to delete ${r2Keys.length} objects (${source}):`, err);

    // Best-effort: log orphaned keys for later cleanup
    try {
      const supabase = createAdminClient();
      const rows = r2Keys.map((key) => ({
        r2_key: key,
        source,
      }));

      // upsert to avoid duplicate constraint violations if retried
      const { error } = await supabase
        .from('r2_orphaned_keys')
        .upsert(rows, { onConflict: 'r2_key', ignoreDuplicates: true });

      if (error) {
        console.error('[R2 Cleanup] Failed to log orphaned keys:', error);
      } else {
        console.log(`[R2 Cleanup] Logged ${r2Keys.length} orphaned keys for later cleanup`);
      }
    } catch (logErr) {
      console.error('[R2 Cleanup] Failed to log orphaned keys:', logErr);
    }
  });
}

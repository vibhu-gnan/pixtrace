import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Detect storage overage and manage the 30-day grace period deadline.
 *
 * Call this after any plan change (upgrade/downgrade/cancel) and on
 * dashboard page loads to catch overage caused by admin actions.
 *
 * Logic:
 *   - Over limit + no deadline  → set 30-day deadline
 *   - Under limit + has deadline → clear deadline (user resolved overage)
 *   - Over limit + deadline set  → no-op (clock keeps ticking)
 *   - Under limit + no deadline  → no-op (healthy state)
 */
export async function checkAndSetGracePeriod(organizerId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: organizer } = await supabase
    .from('organizers')
    .select('plan_id, storage_used_bytes, custom_storage_limit_bytes, storage_grace_deadline')
    .eq('id', organizerId)
    .single();

  if (!organizer) return;

  const { data: plan } = await supabase
    .from('plans')
    .select('storage_limit_bytes')
    .eq('id', organizer.plan_id)
    .single();

  const effectiveLimit =
    organizer.custom_storage_limit_bytes ?? plan?.storage_limit_bytes ?? 1073741824;
  const isUnlimited = effectiveLimit === 0;
  const isOverLimit = !isUnlimited && (organizer.storage_used_bytes ?? 0) > effectiveLimit;

  if (isOverLimit && !organizer.storage_grace_deadline) {
    // Newly over limit — start the 30-day clock
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    await supabase
      .from('organizers')
      .update({
        storage_grace_deadline: deadline.toISOString(),
        storage_grace_notified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizerId);
  } else if (!isOverLimit && organizer.storage_grace_deadline) {
    // Was over limit, now under — clear all grace/warning state
    await supabase
      .from('organizers')
      .update({
        storage_grace_deadline: null,
        storage_grace_notified_at: null,
        storage_deletion_warned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizerId);
  }
  // Over limit + deadline exists → no-op (clock keeps ticking)
  // Under limit + no deadline → no-op (healthy)
}

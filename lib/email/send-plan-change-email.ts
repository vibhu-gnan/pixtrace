import { createAdminClient } from '@/lib/supabase/admin';

/** Known plan hierarchy — higher index = higher tier */
const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'] as const;

function formatStorage(bytes: number): string {
  if (bytes === 0) return 'Unlimited';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${Math.round(gb)} GB` : `${Math.round(gb * 1024)} MB`;
}

function formatEvents(max: number): string {
  if (max === 0) return 'Unlimited events';
  return `${max} event${max !== 1 ? 's' : ''}`;
}

/**
 * Fire-and-forget plan change email.
 * Looks up both plans and the user, then sends the notification.
 * Callers should `.catch()` and move on — this should never crash the caller.
 */
export async function sendPlanChangeEmail(
  organizerId: string,
  oldPlanId: string,
  newPlanId: string,
): Promise<boolean> {
  // Defensive: skip if plans are identical (caller should guard, but just in case)
  if (oldPlanId === newPlanId) return false;

  const supabase = createAdminClient();

  // Fetch user info and both plans in parallel
  const [{ data: organizer }, { data: plans }] = await Promise.all([
    supabase
      .from('organizers')
      .select('email, name')
      .eq('id', organizerId)
      .single(),
    supabase
      .from('plans')
      .select('id, name, storage_limit_bytes, max_events, features')
      .in('id', [oldPlanId, newPlanId]),
  ]);

  // Validate organizer has a usable email
  if (!organizer?.email) {
    console.warn(`[PlanChangeEmail] No email for organizer ${organizerId}. Skipping.`);
    return false;
  }

  // .in() with two distinct IDs should return exactly 2 rows
  if (!plans || plans.length < 2) {
    console.warn(
      `[PlanChangeEmail] Could not resolve both plans (old=${oldPlanId}, new=${newPlanId}). Skipping.`,
    );
    return false;
  }

  const oldPlan = plans.find((p: { id: string }) => p.id === oldPlanId);
  const newPlan = plans.find((p: { id: string }) => p.id === newPlanId);
  if (!oldPlan || !newPlan) return false;

  // Determine direction — default to 'upgrade' for unknown plan IDs not in our hierarchy
  const oldIdx = PLAN_ORDER.indexOf(oldPlanId as (typeof PLAN_ORDER)[number]);
  const newIdx = PLAN_ORDER.indexOf(newPlanId as (typeof PLAN_ORDER)[number]);
  const direction: 'upgrade' | 'downgrade' =
    oldIdx === -1 || newIdx === -1
      ? 'upgrade' // Unknown plan → treat as upgrade (safer default, more positive tone)
      : newIdx > oldIdx
        ? 'upgrade'
        : 'downgrade';

  // Extract up to 5 human-readable feature strings from the jsonb array
  const newFeatures: string[] = Array.isArray(newPlan.features)
    ? (newPlan.features as string[])
        .filter((f): f is string => typeof f === 'string' && f.length > 0)
        .slice(0, 5)
    : [];

  const { planChangeSubject, planChangeHtml } = await import(
    '@/lib/email/templates/plan-change'
  );
  const { sendEmail } = await import('@/lib/email/resend');

  return sendEmail({
    to: organizer.email,
    subject: planChangeSubject(direction),
    html: planChangeHtml({
      name: organizer.name,
      direction,
      oldPlanName: oldPlan.name,
      newPlanName: newPlan.name,
      oldStorage: formatStorage(oldPlan.storage_limit_bytes),
      newStorage: formatStorage(newPlan.storage_limit_bytes),
      oldMaxEvents: formatEvents(oldPlan.max_events),
      newMaxEvents: formatEvents(newPlan.max_events),
      features: newFeatures,
    }),
    emailType: 'plan_change',
  });
}

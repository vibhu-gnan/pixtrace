import { createAdminClient } from '@/lib/supabase/admin';

export interface PlanLimits {
  planId: string;
  planName: string;
  storageLimitBytes: number;
  maxEvents: number;
  storageUsedBytes: number;
  eventCount: number;
  featureFlags: Record<string, unknown>;
}

export async function getOrganizerPlanLimits(organizerId: string): Promise<PlanLimits> {
  const supabase = createAdminClient();

  const { data: organizer } = await supabase
    .from('organizers')
    .select('plan_id, storage_used_bytes')
    .eq('id', organizerId)
    .single();

  const planId = organizer?.plan_id || 'free';
  const storageUsedBytes = organizer?.storage_used_bytes || 0;

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  const { count: eventCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('organizer_id', organizerId);

  return {
    planId,
    planName: plan?.name || 'Free',
    storageLimitBytes: plan?.storage_limit_bytes ?? 1073741824,
    maxEvents: plan?.max_events ?? 1,
    storageUsedBytes,
    eventCount: eventCount || 0,
    featureFlags: (plan?.feature_flags as Record<string, unknown>) || {},
  };
}

export function canCreateEvent(limits: PlanLimits): { allowed: boolean; reason?: string } {
  if (limits.maxEvents === 0) return { allowed: true };
  if (limits.eventCount >= limits.maxEvents) {
    return {
      allowed: false,
      reason: `Your ${limits.planName} plan allows ${limits.maxEvents} event${limits.maxEvents > 1 ? 's' : ''}. Upgrade to create more.`,
    };
  }
  return { allowed: true };
}

export function canUpload(limits: PlanLimits, fileSizeBytes: number): { allowed: boolean; reason?: string } {
  if (limits.storageLimitBytes === 0) return { allowed: true };
  if (limits.storageUsedBytes + fileSizeBytes > limits.storageLimitBytes) {
    const usedGB = (limits.storageUsedBytes / (1024 ** 3)).toFixed(1);
    const limitGB = (limits.storageLimitBytes / (1024 ** 3)).toFixed(0);
    return {
      allowed: false,
      reason: `Storage limit reached (${usedGB}GB of ${limitGB}GB used). Upgrade for more storage.`,
    };
  }
  return { allowed: true };
}

export function hasFeature(limits: PlanLimits, feature: string): boolean {
  return !!limits.featureFlags[feature];
}

export async function incrementStorageUsed(organizerId: string, bytes: number): Promise<void> {
  const supabase = createAdminClient();
  await supabase.rpc('increment_storage_used', {
    org_id: organizerId,
    bytes_to_add: bytes,
  });
}

export async function decrementStorageUsed(organizerId: string, bytes: number): Promise<void> {
  const supabase = createAdminClient();
  await supabase.rpc('increment_storage_used', {
    org_id: organizerId,
    bytes_to_add: -bytes,
  });
}

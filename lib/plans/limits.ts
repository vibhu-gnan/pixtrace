import { createAdminClient } from '@/lib/supabase/admin';

export interface PlanLimits {
  planId: string;
  planName: string;
  storageLimitBytes: number;
  maxEvents: number;
  storageUsedBytes: number;
  eventCount: number;
  featureFlags: Record<string, unknown>;
  customOverrides: {
    storage: boolean;
    events: boolean;
    features: boolean;
  };
}

export async function getOrganizerPlanLimits(organizerId: string): Promise<PlanLimits> {
  const supabase = createAdminClient();

  // Fetch organizer first (needed for plan_id)
  const { data: organizer } = await supabase
    .from('organizers')
    .select('plan_id, storage_used_bytes, custom_storage_limit_bytes, custom_max_events, custom_feature_flags')
    .eq('id', organizerId)
    .single();

  const planId = organizer?.plan_id || 'free';
  const storageUsedBytes = organizer?.storage_used_bytes || 0;

  // Parallelize: plan fetch + event count are independent once we have planId
  const [{ data: plan }, { count: eventCount }] = await Promise.all([
    supabase.from('plans').select('*').eq('id', planId).single(),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('organizer_id', organizerId),
  ]);

  // Determine effective limits: custom overrides > plan defaults
  const hasCustomStorage = organizer?.custom_storage_limit_bytes != null;
  const hasCustomEvents = organizer?.custom_max_events != null;
  const hasCustomFeatures = organizer?.custom_feature_flags != null
    && typeof organizer.custom_feature_flags === 'object'
    && Object.keys(organizer.custom_feature_flags as object).length > 0;

  const planFeatureFlags = (plan?.feature_flags as Record<string, unknown>) || {};
  const customFeatureFlags = hasCustomFeatures
    ? (organizer!.custom_feature_flags as Record<string, unknown>)
    : {};

  // Deep merge: plan defaults + custom overrides (custom wins)
  const effectiveFeatureFlags = hasCustomFeatures
    ? { ...planFeatureFlags, ...customFeatureFlags }
    : planFeatureFlags;

  return {
    planId,
    planName: plan?.name || 'Free',
    storageLimitBytes: hasCustomStorage
      ? (organizer!.custom_storage_limit_bytes as number)
      : (plan?.storage_limit_bytes ?? 1073741824),
    maxEvents: hasCustomEvents
      ? (organizer!.custom_max_events as number)
      : (plan?.max_events ?? 1),
    storageUsedBytes,
    eventCount: eventCount || 0,
    featureFlags: effectiveFeatureFlags,
    customOverrides: {
      storage: hasCustomStorage,
      events: hasCustomEvents,
      features: hasCustomFeatures,
    },
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

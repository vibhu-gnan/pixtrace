'use server';

import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayClient } from '@/lib/razorpay/client';
import type { PlanData } from '@/types';

export async function getAllPlans(): Promise<PlanData[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching plans:', error);
    return [];
  }
  return data || [];
}

export async function getSubscriptionDetails() {
  try {
    const organizer = await getCurrentOrganizer();
    if (!organizer) return null;

    const supabase = createAdminClient();

    const [subResult, planResult, paymentsResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('organizer_id', organizer.id)
        .in('status', ['active', 'pending', 'halted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('plans')
        .select('*')
        .eq('id', organizer.plan_id)
        .single(),
      supabase
        .from('payment_history')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (subResult.error) console.error('Error fetching subscription:', subResult.error);
    if (planResult.error) console.error('Error fetching plan:', planResult.error);
    if (paymentsResult.error) console.error('Error fetching payments:', paymentsResult.error);

    return {
      organizer,
      subscription: subResult.data,
      plan: planResult.data,
      payments: paymentsResult.data || [],
    };
  } catch (err) {
    console.error('Error in getSubscriptionDetails:', err);
    return null;
  }
}

export async function cancelSubscription() {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organizer_id', organizer.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.razorpay_subscription_id) {
    return { error: 'No active subscription found' };
  }

  try {
    const razorpay = getRazorpayClient();
    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, true);

    const { error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        pending_plan_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    if (error) {
      console.error('Error saving cancellation:', error);
      return { error: 'Your subscription was cancelled with our payment provider, but saving it failed. Please contact support.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error cancelling subscription:', err);
    return { error: 'Failed to cancel subscription. Please try again.' };
  }
}

/**
 * Immediately cancel a HALTED subscription (repeated payment failures) so
 * the organizer can start a fresh subscription. Unlike cancelSubscription(),
 * this cancels right away rather than at cycle end — a halted subscription
 * isn't being paid for successfully anyway, so there's no "remaining paid
 * period" to preserve.
 */
export async function cancelHaltedSubscription() {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organizer_id', organizer.id)
    .eq('status', 'halted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.razorpay_subscription_id) {
    return { error: 'No halted subscription found' };
  }

  try {
    const razorpay = getRazorpayClient();
    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, false);

    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        pending_plan_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    if (error) {
      console.error('Error saving halted-subscription cancellation:', error);
      return { error: 'Your subscription was cancelled with our payment provider, but saving it failed. Please contact support.' };
    }

    // Webhook's subscription.cancelled will also fire and is safe to
    // double-apply, but revert the organizer here too so the UI updates
    // immediately rather than waiting on webhook delivery.
    await supabase
      .from('organizers')
      .update({ plan_id: 'free', updated_at: new Date().toISOString() })
      .eq('id', organizer.id);

    return { success: true };
  } catch (err) {
    console.error('Error cancelling halted subscription:', err);
    return { error: 'Failed to cancel subscription. Please try again.' };
  }
}

'use server';

import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayClient } from '@/lib/razorpay/client';

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
    .single();

  if (!sub?.razorpay_subscription_id) {
    return { error: 'No active subscription found' };
  }

  try {
    const razorpay = getRazorpayClient();
    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, true);

    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    return { success: true };
  } catch (err) {
    console.error('Error cancelling subscription:', err);
    return { error: 'Failed to cancel subscription. Please try again.' };
  }
}

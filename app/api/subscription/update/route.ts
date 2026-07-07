import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayClient } from '@/lib/razorpay/client';
import { checkAndSetGracePeriod } from '@/lib/plans/grace-period';
import { captureError } from '@/lib/monitoring/sentry';

const PLAN_SORT_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { targetPlanId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { targetPlanId } = body;
  if (!targetPlanId || !['starter', 'pro'].includes(targetPlanId)) {
    return NextResponse.json({ error: 'Invalid target plan' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch the organizer's active subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organizer_id', organizer.id)
    .in('status', ['active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub || !sub.razorpay_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
  }

  if (sub.cancel_at_period_end) {
    return NextResponse.json(
      { error: 'Cannot change plan on a subscription scheduled for cancellation' },
      { status: 400 },
    );
  }

  if (sub.pending_plan_id) {
    return NextResponse.json(
      { error: 'A plan change is already scheduled. Please wait for it to take effect.' },
      { status: 400 },
    );
  }

  if (sub.plan_id === targetPlanId) {
    return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });
  }

  // Fetch target plan to get its razorpay_plan_id
  const { data: targetPlan } = await supabase
    .from('plans')
    .select('*')
    .eq('id', targetPlanId)
    .eq('is_active', true)
    .single();

  if (!targetPlan || !targetPlan.razorpay_plan_id) {
    return NextResponse.json({ error: 'Target plan not available' }, { status: 400 });
  }

  const currentOrder = PLAN_SORT_ORDER[sub.plan_id] ?? 0;
  const targetOrder = PLAN_SORT_ORDER[targetPlanId] ?? 0;
  const isUpgrade = targetOrder > currentOrder;

  const razorpay = getRazorpayClient();
  const now = new Date().toISOString();

  try {
    // Call Razorpay to update the subscription plan
    await (razorpay.subscriptions.update as Function)(sub.razorpay_subscription_id, {
      plan_id: targetPlan.razorpay_plan_id,
      schedule_change_at: isUpgrade ? 'now' : 'cycle_end',
    });

    if (isUpgrade) {
      // Immediate upgrade: update plan in both subscription and organizer
      const [subResult, orgResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .update({ plan_id: targetPlanId, pending_plan_id: null, updated_at: now })
          .eq('id', sub.id),
        supabase
          .from('organizers')
          .update({ plan_id: targetPlanId, updated_at: now })
          .eq('id', organizer.id),
      ]);

      // Razorpay already applied the change at this point — a DB write
      // failure here is a real inconsistency, not a normal error. Surface it
      // loudly and don't tell the user it succeeded.
      if (subResult.error || orgResult.error) {
        captureError(subResult.error || orgResult.error, {
          source: 'subscription-update',
          level: 'error',
          extra: {
            organizerId: organizer.id,
            subscriptionId: sub.id,
            targetPlanId,
            subError: subResult.error?.message,
            orgError: orgResult.error?.message,
          },
        });
        return NextResponse.json(
          { error: 'Your plan was updated with our payment provider, but saving it failed. Please contact support.' },
          { status: 500 },
        );
      }

      // Grace period: may clear if user is now under the new (higher) limit
      await checkAndSetGracePeriod(organizer.id).catch((err) => {
        console.error('[Subscription Update] Grace period check failed:', err);
      });

      // Fire-and-forget: send plan change notification email. The webhook's
      // own email-send only fires when it observes a plan diff — since we
      // just wrote the new plan_id ourselves, the webhook will see no diff
      // and skip it, so this route owns the notification for upgrades.
      import('@/lib/email/send-plan-change-email')
        .then(({ sendPlanChangeEmail }) => sendPlanChangeEmail(organizer.id, sub.plan_id, targetPlanId))
        .catch((err) => {
          console.error('[Subscription Update] Plan change email failed:', err);
        });

      return NextResponse.json({
        success: true,
        immediate: true,
        newPlanId: targetPlanId,
        message: `Upgraded to ${targetPlan.name}. Changes are effective immediately.`,
      });
    } else {
      // Scheduled downgrade: mark pending, actual change happens via webhook
      const { error: pendingErr } = await supabase
        .from('subscriptions')
        .update({ pending_plan_id: targetPlanId, updated_at: now })
        .eq('id', sub.id);

      if (pendingErr) {
        captureError(pendingErr, {
          source: 'subscription-update',
          level: 'error',
          extra: { organizerId: organizer.id, subscriptionId: sub.id, targetPlanId },
        });
        return NextResponse.json(
          { error: 'Your plan change was scheduled with our payment provider, but saving it failed. Please contact support.' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        immediate: false,
        pendingPlanId: targetPlanId,
        effectiveDate: sub.current_period_end,
        message: `Switching to ${targetPlan.name} at the end of your current billing period.`,
      });
    }
  } catch (error) {
    console.error('[Subscription Update] Razorpay API error:', error);
    return NextResponse.json({ error: 'Failed to update subscription. Please try again.' }, { status: 500 });
  }
}

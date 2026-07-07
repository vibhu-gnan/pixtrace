import { NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayClient } from '@/lib/razorpay/client';
import { captureError } from '@/lib/monitoring/sentry';

/**
 * POST /api/subscription/undo-change
 *
 * Cancels a scheduled (cycle-end) downgrade before it takes effect, so a
 * user isn't permanently locked out of plan changes if they change their
 * mind — or if the pending state would otherwise never clear (e.g. the
 * change is removed on Razorpay's side and no webhook diff triggers our
 * normal pending_plan_id-clearing path).
 */
export async function POST() {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organizer_id', organizer.id)
    .in('status', ['active', 'pending', 'halted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub || !sub.razorpay_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
  }

  if (!sub.pending_plan_id) {
    return NextResponse.json({ error: 'No plan change is scheduled' }, { status: 400 });
  }

  const razorpay = getRazorpayClient();

  try {
    await (razorpay.subscriptions.cancelScheduledChanges as Function)(sub.razorpay_subscription_id);
  } catch (error) {
    console.error('[Subscription Undo Change] Razorpay API error:', error);
    return NextResponse.json({ error: 'Failed to undo the scheduled change. Please try again.' }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from('subscriptions')
    .update({ pending_plan_id: null, updated_at: new Date().toISOString() })
    .eq('id', sub.id);

  if (updateErr) {
    captureError(updateErr, {
      source: 'subscription-undo-change',
      level: 'error',
      extra: { organizerId: organizer.id, subscriptionId: sub.id },
    });
    return NextResponse.json(
      { error: 'The change was undone with our payment provider, but saving it failed. Please contact support.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

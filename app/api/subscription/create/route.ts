import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayClient } from '@/lib/razorpay/client';

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { planId } = body;

  if (!planId || !['starter', 'pro'].includes(planId)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const razorpay = getRazorpayClient();

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!plan || !plan.razorpay_plan_id) {
    return NextResponse.json({ error: 'Plan not available for subscription' }, { status: 400 });
  }

  // Look up the organizer's most recent live subscription. A cancel-pending
  // sub is a reactivation case (allowed, with start_at deferred to its period
  // end below); any other live sub blocks creation to avoid double-billing.
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id, status, cancel_at_period_end, current_period_end')
    .eq('organizer_id', organizer.id)
    .in('status', ['active', 'authenticated', 'pending', 'halted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSub && !existingSub.cancel_at_period_end) {
    return NextResponse.json(
      { error: 'You already have an active subscription. Cancel it before starting a new one.' },
      { status: 400 },
    );
  }

  // Reactivation: the old subscription is cancel-pending but still paid
  // through its period end. Defer the new subscription's start so it
  // doesn't bill until the old one actually lapses (avoids double-charging
  // the overlap).
  const startAt = existingSub?.cancel_at_period_end && existingSub.current_period_end
    ? Math.floor(new Date(existingSub.current_period_end).getTime() / 1000)
    : undefined;

  try {
    let customerId = organizer.razorpay_customer_id;
    if (!customerId) {
      const customer = await razorpay.customers.create({
        name: organizer.name || organizer.email.split('@')[0],
        email: organizer.email,
        fail_existing: 0,
      });
      customerId = customer.id;

      await supabase
        .from('organizers')
        .update({ razorpay_customer_id: customerId })
        .eq('id', organizer.id);
    }

    // customer_id is supported by Razorpay API but missing from their TS types
    const subscription = await (razorpay.subscriptions.create as Function)({
      plan_id: plan.razorpay_plan_id,
      customer_id: customerId,
      total_count: 120,
      customer_notify: 0,
      ...(startAt ? { start_at: startAt } : {}),
      notes: {
        organizer_id: organizer.id,
        plan_id: planId,
      },
    });

    const { error: insertErr } = await supabase.from('subscriptions').insert({
      organizer_id: organizer.id,
      plan_id: planId,
      razorpay_subscription_id: subscription.id,
      status: 'created',
    });

    if (insertErr) {
      // The Razorpay subscription exists but we couldn't record it — the
      // verify step looks it up by razorpay_subscription_id, so letting
      // checkout proceed here would let the user pay for a subscription we
      // can never activate. Fail now instead.
      console.error('[Subscription Create] Failed to save subscription row:', insertErr, subscription.id);
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: plan.price_monthly,
      currency: plan.currency,
      planName: plan.name,
      organizerName: organizer.name,
      organizerEmail: organizer.email,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}

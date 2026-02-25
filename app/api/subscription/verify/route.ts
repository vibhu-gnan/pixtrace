import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
  } = await request.json();

  if (!razorpay_subscription_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_subscription_id', razorpay_subscription_id)
    .eq('organizer_id', organizer.id)
    .single();

  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      razorpay_payment_id,
      razorpay_signature,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', sub.id);

  await supabase
    .from('organizers')
    .update({
      plan_id: sub.plan_id,
      updated_at: now.toISOString(),
    })
    .eq('id', organizer.id);

  await supabase.from('payment_history').insert({
    organizer_id: organizer.id,
    subscription_id: sub.id,
    razorpay_payment_id,
    amount: 0,
    currency: 'INR',
    status: 'captured',
    paid_at: now.toISOString(),
  });

  return NextResponse.json({ success: true, planId: sub.plan_id });
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (expectedSignature !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);
  const supabase = createAdminClient();

  try {
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged':
        await handleSubscriptionCharged(supabase, event.payload);
        break;
      case 'subscription.pending':
        await handleStatusUpdate(supabase, event.payload, 'pending');
        break;
      case 'subscription.halted':
        await handleSubscriptionHalted(supabase, event.payload);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(supabase, event.payload);
        break;
      case 'subscription.completed':
        await handleSubscriptionCancelled(supabase, event.payload);
        break;
      case 'payment.captured':
        await handlePaymentCaptured(supabase, event.payload);
        break;
      default:
        console.log('Unhandled Razorpay webhook:', event.event);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionCharged(supabase: ReturnType<typeof createAdminClient>, payload: any) {
  const razorpaySubId = payload.subscription?.entity?.id;
  if (!razorpaySubId) return;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_subscription_id', razorpaySubId)
    .single();

  if (!sub) return;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      grace_period_end: null,
      updated_at: now.toISOString(),
    })
    .eq('id', sub.id);

  await supabase
    .from('organizers')
    .update({ plan_id: sub.plan_id, updated_at: now.toISOString() })
    .eq('id', sub.organizer_id);

  const payment = payload.payment?.entity;
  if (payment) {
    await supabase.from('payment_history').upsert({
      organizer_id: sub.organizer_id,
      subscription_id: sub.id,
      razorpay_payment_id: payment.id,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      status: 'captured',
      method: payment.method || null,
      paid_at: now.toISOString(),
    }, { onConflict: 'razorpay_payment_id' });
  }
}

async function handleStatusUpdate(supabase: ReturnType<typeof createAdminClient>, payload: any, status: string) {
  const razorpaySubId = payload.subscription?.entity?.id;
  if (!razorpaySubId) return;

  await supabase
    .from('subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', razorpaySubId);
}

async function handleSubscriptionHalted(supabase: ReturnType<typeof createAdminClient>, payload: any) {
  const razorpaySubId = payload.subscription?.entity?.id;
  if (!razorpaySubId) return;

  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + 3);

  await supabase
    .from('subscriptions')
    .update({
      status: 'halted',
      grace_period_end: graceEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('razorpay_subscription_id', razorpaySubId);
}

async function handleSubscriptionCancelled(supabase: ReturnType<typeof createAdminClient>, payload: any) {
  const razorpaySubId = payload.subscription?.entity?.id;
  if (!razorpaySubId) return;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_subscription_id', razorpaySubId)
    .single();

  if (!sub) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  if (!sub.cancel_at_period_end) {
    await supabase
      .from('organizers')
      .update({ plan_id: 'free', updated_at: new Date().toISOString() })
      .eq('id', sub.organizer_id);
  }
}

async function handlePaymentCaptured(supabase: ReturnType<typeof createAdminClient>, payload: any) {
  const payment = payload.payment?.entity;
  if (!payment) return;

  const notes = payment.notes || {};
  const organizerId = notes.organizer_id;
  if (!organizerId) return;

  await supabase.from('payment_history').upsert({
    organizer_id: organizerId,
    razorpay_payment_id: payment.id,
    razorpay_order_id: payment.order_id || null,
    amount: payment.amount,
    currency: payment.currency || 'INR',
    status: 'captured',
    method: payment.method || null,
    paid_at: new Date().toISOString(),
  }, { onConflict: 'razorpay_payment_id' });
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
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

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      console.error('RAZORPAY_KEY_SECRET not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(razorpay_signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
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

    const { error: subUpdateErr } = await supabase
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

    if (subUpdateErr) {
      console.error('Error activating subscription:', subUpdateErr);
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 });
    }

    const { error: orgUpdateErr } = await supabase
      .from('organizers')
      .update({
        plan_id: sub.plan_id,
        updated_at: now.toISOString(),
      })
      .eq('id', organizer.id);

    if (orgUpdateErr) {
      console.error('Error updating organizer plan:', orgUpdateErr);
    }

    // Record initial verification payment (amount populated by webhook on actual charge)
    await supabase.from('payment_history').upsert({
      organizer_id: organizer.id,
      subscription_id: sub.id,
      razorpay_payment_id,
      amount: sub.amount || 0,
      currency: 'INR',
      status: 'captured',
      description: `Subscription verification — ${sub.plan_id} plan`,
      paid_at: now.toISOString(),
    }, { onConflict: 'razorpay_payment_id' });

    return NextResponse.json({ success: true, planId: sub.plan_id });
  } catch (err) {
    console.error('Subscription verification error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

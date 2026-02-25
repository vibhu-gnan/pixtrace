import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayClient } from '@/lib/razorpay/client';

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { planId } = await request.json();

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

    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpay_plan_id,
      customer_id: customerId,
      total_count: 120,
      customer_notify: 0,
      notes: {
        organizer_id: organizer.id,
        plan_id: planId,
      },
    });

    await supabase.from('subscriptions').insert({
      organizer_id: organizer.id,
      plan_id: planId,
      razorpay_subscription_id: subscription.id,
      status: 'created',
    });

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

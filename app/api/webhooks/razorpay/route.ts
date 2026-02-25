import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

type SupabaseClient = ReturnType<typeof createAdminClient>;

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

  console.log(`[Razorpay Webhook] ${event.event}`);

  try {
    switch (event.event) {

      // ── Subscription lifecycle ──────────────────────────────────────────────
      case 'subscription.authenticated':
        await handleStatusUpdate(supabase, event.payload, 'authenticated');
        break;

      case 'subscription.activated':
      case 'subscription.charged':
        await handleSubscriptionCharged(supabase, event.payload);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(supabase, event.payload);
        break;

      case 'subscription.pending':
        await handleStatusUpdate(supabase, event.payload, 'pending');
        break;

      case 'subscription.halted':
        await handleSubscriptionHalted(supabase, event.payload);
        break;

      case 'subscription.paused':
        await handleStatusUpdate(supabase, event.payload, 'paused');
        break;

      case 'subscription.resumed':
        await handleSubscriptionResumed(supabase, event.payload);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(supabase, event.payload);
        break;

      case 'subscription.completed':
        await handleSubscriptionCompleted(supabase, event.payload);
        break;

      // ── Payment events ──────────────────────────────────────────────────────
      case 'payment.authorized':
        await handlePaymentEvent(supabase, event.payload, 'authorized');
        break;

      case 'payment.captured':
        await handlePaymentEvent(supabase, event.payload, 'captured');
        break;

      case 'payment.failed':
        await handlePaymentEvent(supabase, event.payload, 'failed');
        break;

      // ── Invoice events ──────────────────────────────────────────────────────
      case 'invoice.paid':
        await handleInvoiceEvent(supabase, event.payload, 'paid');
        break;

      case 'invoice.partially_paid':
        await handleInvoiceEvent(supabase, event.payload, 'partially_paid');
        break;

      case 'invoice.expired':
        await handleInvoiceEvent(supabase, event.payload, 'expired');
        break;

      // ── Refund events ───────────────────────────────────────────────────────
      case 'refund.created':
        await handleRefundEvent(supabase, event.payload, 'refund_initiated');
        break;

      case 'refund.processed':
        await handleRefundEvent(supabase, event.payload, 'refunded');
        break;

      case 'refund.failed':
        await handleRefundEvent(supabase, event.payload, 'refund_failed');
        break;

      // ── Dispute events ──────────────────────────────────────────────────────
      case 'payment.dispute.created':
        await handleDisputeCreated(supabase, event.payload);
        break;

      case 'payment.dispute.won':
        await handleDisputeWon(supabase, event.payload);
        break;

      default:
        console.log(`[Razorpay Webhook] Unhandled event: ${event.event}`);
    }
  } catch (err) {
    // Return 200 so Razorpay doesn't retry endlessly — error is logged for manual review
    console.error(`[Razorpay Webhook] Handler error for ${event.event}:`, err);
  }

  return NextResponse.json({ received: true });
}

// ── Subscription: Activated / Charged ─────────────────────────────────────────
async function handleSubscriptionCharged(supabase: SupabaseClient, payload: any) {
  const subEntity = payload.subscription?.entity;
  if (!subEntity?.id) return;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_subscription_id', subEntity.id)
    .single();

  if (!sub) return;

  // Use Razorpay's timestamps when available, fall back to calculated
  const now = new Date();
  const periodStart = subEntity.current_start
    ? new Date(subEntity.current_start * 1000)
    : now;
  const periodEnd = subEntity.current_end
    ? new Date(subEntity.current_end * 1000)
    : new Date(new Date().setMonth(now.getMonth() + 1));

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: periodStart.toISOString(),
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
      description: `Subscription payment — ${sub.plan_id} plan`,
      paid_at: now.toISOString(),
    }, { onConflict: 'razorpay_payment_id' });
  }
}

// ── Subscription: Updated (plan upgrade/downgrade) ─────────────────────────────
async function handleSubscriptionUpdated(supabase: SupabaseClient, payload: any) {
  const subEntity = payload.subscription?.entity;
  if (!subEntity?.id) return;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_subscription_id', subEntity.id)
    .single();

  if (!sub) return;

  // If the Razorpay plan changed, resolve the new plan_id from our plans table
  if (subEntity.plan_id) {
    const { data: plan } = await supabase
      .from('plans')
      .select('id')
      .eq('razorpay_plan_id', subEntity.plan_id)
      .single();

    if (plan && plan.id !== sub.plan_id) {
      await supabase
        .from('subscriptions')
        .update({ plan_id: plan.id, updated_at: new Date().toISOString() })
        .eq('id', sub.id);

      await supabase
        .from('organizers')
        .update({ plan_id: plan.id, updated_at: new Date().toISOString() })
        .eq('id', sub.organizer_id);

      console.log(`[Razorpay Webhook] Plan updated: organizer ${sub.organizer_id} → ${plan.id}`);
    }
  }
}

// ── Subscription: Resumed ──────────────────────────────────────────────────────
async function handleSubscriptionResumed(supabase: SupabaseClient, payload: any) {
  const razorpaySubId = payload.subscription?.entity?.id;
  if (!razorpaySubId) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      grace_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('razorpay_subscription_id', razorpaySubId);
}

// ── Subscription: Halted ───────────────────────────────────────────────────────
async function handleSubscriptionHalted(supabase: SupabaseClient, payload: any) {
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

// ── Subscription: Cancelled ────────────────────────────────────────────────────
async function handleSubscriptionCancelled(supabase: SupabaseClient, payload: any) {
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

  // Immediately revert to free unless scheduled to cancel at period end
  if (!sub.cancel_at_period_end) {
    await supabase
      .from('organizers')
      .update({ plan_id: 'free', updated_at: new Date().toISOString() })
      .eq('id', sub.organizer_id);
  }
}

// ── Subscription: Completed (full fixed term ended) ────────────────────────────
async function handleSubscriptionCompleted(supabase: SupabaseClient, payload: any) {
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
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  // Term ended naturally — revert to free
  await supabase
    .from('organizers')
    .update({ plan_id: 'free', updated_at: new Date().toISOString() })
    .eq('id', sub.organizer_id);
}

// ── Generic subscription status update ────────────────────────────────────────
async function handleStatusUpdate(supabase: SupabaseClient, payload: any, status: string) {
  const razorpaySubId = payload.subscription?.entity?.id;
  if (!razorpaySubId) return;

  await supabase
    .from('subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', razorpaySubId);
}

// ── Payment: Authorized / Captured / Failed ────────────────────────────────────
async function handlePaymentEvent(supabase: SupabaseClient, payload: any, status: string) {
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
    status,
    method: payment.method || null,
    description: notes.description || null,
    paid_at: status === 'captured' ? new Date().toISOString() : null,
  }, { onConflict: 'razorpay_payment_id' });
}

// ── Invoice: Paid / Partially Paid / Expired ───────────────────────────────────
async function handleInvoiceEvent(supabase: SupabaseClient, payload: any, status: string) {
  const invoice = payload.invoice?.entity;
  if (!invoice?.id) return;

  // Invoices tie back to subscriptions
  const razorpaySubId = invoice.subscription_id;
  if (!razorpaySubId) return;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('organizer_id, id')
    .eq('razorpay_subscription_id', razorpaySubId)
    .single();

  if (!sub) return;

  const payment = payload.payment?.entity;

  // Only upsert if we have a payment_id to avoid null-conflict issues
  if (payment?.id) {
    await supabase.from('payment_history').upsert({
      organizer_id: sub.organizer_id,
      subscription_id: sub.id,
      razorpay_payment_id: payment.id,
      razorpay_invoice_id: invoice.id,
      amount: payment.amount || invoice.amount_paid || 0,
      currency: invoice.currency || 'INR',
      status,
      method: payment.method || null,
      description: `Invoice ${invoice.id} — ${status}`,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    }, { onConflict: 'razorpay_payment_id' });
  } else {
    // Log invoice-only events (expired, partially paid without payment entity)
    console.log(`[Razorpay Webhook] Invoice ${invoice.id} ${status} — no payment entity`);
  }
}

// ── Refund: Created / Processed / Failed ──────────────────────────────────────
async function handleRefundEvent(supabase: SupabaseClient, payload: any, status: string) {
  const refund = payload.refund?.entity;
  if (!refund?.payment_id) return;

  // Update the original payment record status
  await supabase
    .from('payment_history')
    .update({ status })
    .eq('razorpay_payment_id', refund.payment_id);

  console.log(`[Razorpay Webhook] Refund ${status} for payment ${refund.payment_id} — amount: ${refund.amount}`);
}

// ── Dispute: Created ───────────────────────────────────────────────────────────
async function handleDisputeCreated(supabase: SupabaseClient, payload: any) {
  const dispute = payload.dispute?.entity;
  if (!dispute?.payment_id) return;

  await supabase
    .from('payment_history')
    .update({ status: 'disputed' })
    .eq('razorpay_payment_id', dispute.payment_id);

  // Prominent alert — chargebacks cost money and need fast response
  console.error(
    `[⚠️ DISPUTE ALERT] Payment ${dispute.payment_id} has been disputed.\n` +
    `Amount: ₹${(dispute.amount / 100).toFixed(2)} | ` +
    `Respond by: ${dispute.respond_by ? new Date(dispute.respond_by * 1000).toISOString() : 'N/A'}`
  );
}

// ── Dispute: Won ───────────────────────────────────────────────────────────────
async function handleDisputeWon(supabase: SupabaseClient, payload: any) {
  const dispute = payload.dispute?.entity;
  if (!dispute?.payment_id) return;

  await supabase
    .from('payment_history')
    .update({ status: 'captured' })
    .eq('razorpay_payment_id', dispute.payment_id);

  console.log(`[Razorpay Webhook] Dispute WON for payment ${dispute.payment_id} ✓`);
}

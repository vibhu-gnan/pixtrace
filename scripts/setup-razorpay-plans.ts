/**
 * One-time script to create Razorpay subscription plans and store their IDs in Supabase.
 *
 * Prerequisites:
 *   1. Run the SQL migration (supabase/migrations/20260225_subscription_system.sql) first
 *   2. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET to your .env.local
 *   3. Add NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY to your .env.local
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/setup-razorpay-plans.ts
 */

import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log('Creating Razorpay subscription plans...\n');

  // Create Starter plan
  console.log('Creating Starter plan (₹2,499/month)...');
  const starterPlan = await razorpay.plans.create({
    period: 'monthly',
    interval: 1,
    item: {
      name: 'PIXTRACE Starter',
      amount: 249900,
      currency: 'INR',
      description: 'Starter plan — 10GB storage, up to 5 events/month',
    },
    notes: { plan_id: 'starter' },
  });
  console.log(`✓ Starter plan created: ${starterPlan.id}`);

  // Create Pro plan
  console.log('Creating Pro plan (₹4,999/month)...');
  const proPlan = await razorpay.plans.create({
    period: 'monthly',
    interval: 1,
    item: {
      name: 'PIXTRACE Pro',
      amount: 499900,
      currency: 'INR',
      description: 'Pro plan — 50GB storage, unlimited events',
    },
    notes: { plan_id: 'pro' },
  });
  console.log(`✓ Pro plan created: ${proPlan.id}`);

  // Save Razorpay plan IDs to Supabase
  console.log('\nUpdating Supabase plans table...');

  const { error: starterErr } = await supabase
    .from('plans')
    .update({ razorpay_plan_id: starterPlan.id })
    .eq('id', 'starter');

  if (starterErr) {
    console.error('Failed to update starter plan:', starterErr.message);
  } else {
    console.log('✓ Starter plan ID saved to Supabase');
  }

  const { error: proErr } = await supabase
    .from('plans')
    .update({ razorpay_plan_id: proPlan.id })
    .eq('id', 'pro');

  if (proErr) {
    console.error('Failed to update pro plan:', proErr.message);
  } else {
    console.log('✓ Pro plan ID saved to Supabase');
  }

  console.log('\n✅ Setup complete!\n');
  console.log('Razorpay Plan IDs:');
  console.log(`  Starter: ${starterPlan.id}`);
  console.log(`  Pro:     ${proPlan.id}`);
  console.log('\nNext steps:');
  console.log('  1. Register webhook URL in Razorpay Dashboard:');
  console.log('     https://pixtrace.in/api/webhooks/razorpay');
  console.log('  2. Enable webhook events:');
  console.log('     subscription.activated, subscription.charged, subscription.pending,');
  console.log('     subscription.halted, subscription.cancelled, subscription.completed,');
  console.log('     payment.captured, payment.failed');
  console.log('  3. Copy the webhook secret and add to .env.local as RAZORPAY_WEBHOOK_SECRET');
}

main().catch((err) => {
  console.error('Script failed:', err.message);
  process.exit(1);
});

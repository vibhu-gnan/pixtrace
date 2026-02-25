-- ============================================================
-- PIXTRACE Subscription System Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id varchar(50) PRIMARY KEY,
  name varchar(100) NOT NULL,
  description text,
  price_monthly integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'INR',
  storage_limit_bytes bigint NOT NULL DEFAULT 0,
  max_events integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  razorpay_plan_id varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Seed plans
INSERT INTO plans (id, name, description, price_monthly, storage_limit_bytes, max_events, features, feature_flags, sort_order) VALUES
  ('free', 'Free', 'Get started with basic gallery hosting.', 0, 1073741824, 1,
   '["1 GB Storage", "1 Event", "Basic Analytics", "Email Support"]'::jsonb,
   '{"analytics": "basic", "watermarking": "standard", "downloads": false, "custom_branding": false, "client_proofing": false}'::jsonb,
   0),
  ('starter', 'Starter', 'Perfect for photographers just getting started with online galleries.', 249900, 10737418240, 5,
   '["10 GB Storage", "Up to 5 Events", "Original Quality Downloads", "Basic Analytics", "Email Support"]'::jsonb,
   '{"analytics": "basic", "watermarking": "standard", "downloads": true, "custom_branding": false, "client_proofing": false}'::jsonb,
   1),
  ('pro', 'Pro', 'For busy professionals handling multiple clients and high volumes.', 499900, 53687091200, 0,
   '["50 GB Storage", "Unlimited Events", "Custom Branding & Domain", "Client Proofing", "Priority Support", "Custom Watermarking"]'::jsonb,
   '{"analytics": "advanced", "watermarking": "custom", "downloads": true, "custom_branding": true, "client_proofing": true}'::jsonb,
   2),
  ('enterprise', 'Enterprise', 'Custom solutions for agencies and large scale studios.', 0, 0, 0,
   '["Unlimited Storage", "White-label Solution", "Dedicated Account Manager", "API Access", "Custom Everything"]'::jsonb,
   '{"analytics": "advanced", "watermarking": "custom", "downloads": true, "custom_branding": true, "client_proofing": true, "api_access": true, "white_label": true}'::jsonb,
   3)
ON CONFLICT (id) DO NOTHING;

-- 3. Add columns to organizers table
ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS plan_id varchar(50) NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS razorpay_customer_id varchar(255),
  ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS organizers_plan_id_idx ON organizers USING btree (plan_id);
CREATE INDEX IF NOT EXISTS organizers_razorpay_customer_id_idx ON organizers USING btree (razorpay_customer_id);

-- 4. Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  plan_id varchar(50) NOT NULL REFERENCES plans(id),
  razorpay_subscription_id varchar(255) UNIQUE,
  razorpay_payment_id varchar(255),
  razorpay_signature varchar(512),
  status varchar(50) NOT NULL DEFAULT 'created',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  grace_period_end timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriptions_organizer_id_idx ON subscriptions USING btree (organizer_id);
CREATE INDEX IF NOT EXISTS subscriptions_razorpay_sub_id_idx ON subscriptions USING btree (razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions USING btree (status);

-- 5. Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  razorpay_payment_id varchar(255) UNIQUE,
  razorpay_order_id varchar(255),
  razorpay_invoice_id varchar(255),
  amount integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'INR',
  status varchar(50) NOT NULL,
  method varchar(50),
  description text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_history_organizer_id_idx ON payment_history USING btree (organizer_id);
CREATE INDEX IF NOT EXISTS payment_history_subscription_id_idx ON payment_history USING btree (subscription_id);

-- 6. Create enterprise_inquiries table
CREATE TABLE IF NOT EXISTS enterprise_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  phone varchar(50),
  organization varchar(255),
  category varchar(100),
  events_per_month integer,
  photos_per_event integer,
  additional_needs text,
  status varchar(50) NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS enterprise_inquiries_status_idx ON enterprise_inquiries USING btree (status);
CREATE INDEX IF NOT EXISTS enterprise_inquiries_email_idx ON enterprise_inquiries USING btree (email);

-- 7. RLS Policies
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable" ON plans FOR SELECT USING (true);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers can view own subscriptions" ON subscriptions
  FOR SELECT USING (organizer_id IN (
    SELECT id FROM organizers WHERE auth_id = auth.uid()::text
  ));

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers can view own payments" ON payment_history
  FOR SELECT USING (organizer_id IN (
    SELECT id FROM organizers WHERE auth_id = auth.uid()::text
  ));

ALTER TABLE enterprise_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit inquiry" ON enterprise_inquiries
  FOR INSERT WITH CHECK (true);

-- 8. Atomic storage increment RPC
CREATE OR REPLACE FUNCTION increment_storage_used(org_id uuid, bytes_to_add bigint)
RETURNS void AS $$
BEGIN
  UPDATE organizers
  SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + bytes_to_add),
      updated_at = now()
  WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

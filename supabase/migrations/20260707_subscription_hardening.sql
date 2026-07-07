-- Hardening for the billing plan-change feature:
--   1. Block accidental double-active subscriptions per organizer, while still
--      allowing the intentional reactivation overlap (old sub cancel-pending +
--      new sub created ahead of its start_at).
--   2. last_event_at on subscriptions + a webhook_events dedup table, so the
--      Razorpay webhook can ignore stale/out-of-order and duplicate deliveries.

-- 1. Partial unique index — only one "live" (non-cancel-pending) subscription
--    per organizer among active/pending/halted statuses.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_organizer_idx
  ON subscriptions (organizer_id)
  WHERE status IN ('active', 'pending', 'halted') AND cancel_at_period_end = false;

-- 2. Webhook ordering guard
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

COMMENT ON COLUMN subscriptions.last_event_at IS
  'Timestamp of the most recent Razorpay webhook event applied to this row. Used to drop out-of-order/stale deliveries.';

-- 3. Webhook idempotency (dedup by Razorpay event id)
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id varchar(255) PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE webhook_events IS
  'Dedup ledger for inbound Razorpay webhook deliveries, keyed by the x-razorpay-event-id header (or event.payload id as fallback).';

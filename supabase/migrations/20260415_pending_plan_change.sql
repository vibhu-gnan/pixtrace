-- Add pending_plan_id to track scheduled downgrades (cycle-end plan changes)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id varchar(50) REFERENCES plans(id);

COMMENT ON COLUMN subscriptions.pending_plan_id IS
  'Set when a downgrade is scheduled at cycle end. Cleared by subscription.updated webhook.';

-- Track all transactional emails sent from the platform.
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL,        -- e.g. 'welcome', 'storage_warning', 'storage_deleted'
  status TEXT NOT NULL DEFAULT 'sent',  -- 'sent', 'failed', 'skipped'
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Primary query: admin page lists by created_at DESC with optional status/type filters
CREATE INDEX idx_email_logs_created_at ON email_logs (created_at DESC);
CREATE INDEX idx_email_logs_status ON email_logs (status);
CREATE INDEX idx_email_logs_email_type ON email_logs (email_type);
CREATE INDEX idx_email_logs_recipient ON email_logs (recipient);

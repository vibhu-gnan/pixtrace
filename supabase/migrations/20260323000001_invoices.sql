-- Invoice tracking table for sequential invoice numbering
-- Format: {plan_code}{DDMMYYYY}{daily_seq} e.g. 01240220260001

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number varchar(20) UNIQUE NOT NULL,
  plan_code varchar(2) NOT NULL DEFAULT '99',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  daily_sequence integer NOT NULL,
  payment_id uuid REFERENCES payment_history(id) ON DELETE SET NULL,
  organizer_id uuid REFERENCES organizers(id) ON DELETE SET NULL,
  recipient_name text NOT NULL DEFAULT '',
  recipient_email text NOT NULL DEFAULT '',
  amount integer NOT NULL DEFAULT 0, -- in paise
  status varchar(20) NOT NULL DEFAULT 'issued',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Ensure no duplicate sequence for same date (global daily counter)
  UNIQUE(issue_date, daily_sequence)
);

-- Index for fast next-sequence lookup
CREATE INDEX IF NOT EXISTS invoices_issue_date_idx ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS invoices_organizer_id_idx ON invoices(organizer_id);
CREATE INDEX IF NOT EXISTS invoices_payment_id_idx ON invoices(payment_id);

-- RLS: admin-only table (service_role key bypasses RLS)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

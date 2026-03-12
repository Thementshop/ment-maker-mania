CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_id UUID,
  chain_id UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  resend_id TEXT,
  status TEXT DEFAULT 'sent',
  metadata JSONB
);

CREATE INDEX idx_email_logs_chain ON email_logs(chain_id);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage email logs"
ON email_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own email logs"
ON email_logs FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());
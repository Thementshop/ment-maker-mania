
-- ============ email_queue ============
CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_id uuid NULL,
  chain_id uuid NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|processing|sent|failed|dlq
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NULL,
  locked_by text NULL,
  last_error text NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_queue_pending ON public.email_queue(status, next_attempt_at) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_email_queue_recipient ON public.email_queue(recipient_email);
CREATE INDEX idx_email_queue_created ON public.email_queue(created_at DESC);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
-- No public policies; service role bypasses RLS.

CREATE TRIGGER trg_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ error_log ============
CREATE TABLE public.error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,        -- send-email, process-email-queue, send-a-ment, etc.
  error_type text NOT NULL,    -- email_failed, token_generation_failed, queue_dlq, etc.
  severity text NOT NULL DEFAULT 'error', -- warn|error|critical
  recipient_email text NULL,
  chain_id uuid NULL,
  ment_id uuid NULL,
  message text NOT NULL,
  context jsonb NULL
);

CREATE INDEX idx_error_log_created ON public.error_log(created_at DESC);
CREATE INDEX idx_error_log_source_type ON public.error_log(source, error_type);

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;
-- Service role only.

-- ============ recipient_login_tokens ============
CREATE TABLE public.recipient_login_tokens (
  email text PRIMARY KEY,
  hashed_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipient_login_tokens_expires ON public.recipient_login_tokens(expires_at);

ALTER TABLE public.recipient_login_tokens ENABLE ROW LEVEL SECURITY;
-- Service role only.

-- ============ get_user_id_by_email RPC ============
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

-- ============ pg_cron: process queue + janitor ============
-- Ensure extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing jobs with same names (idempotent)
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'process-email-queue-job';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;

  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'email-queue-janitor';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

-- Process the queue every minute
SELECT cron.schedule(
  'process-email-queue-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjnukzmjenfvuopooumb.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);

-- Janitor: delete sent rows older than 7 days, daily at 03:00 UTC
SELECT cron.schedule(
  'email-queue-janitor',
  '0 3 * * *',
  $$
  DELETE FROM public.email_queue WHERE status = 'sent' AND created_at < now() - interval '7 days';
  DELETE FROM public.recipient_login_tokens WHERE expires_at < now() - interval '1 day';
  DELETE FROM public.error_log WHERE created_at < now() - interval '30 days';
  $$
);

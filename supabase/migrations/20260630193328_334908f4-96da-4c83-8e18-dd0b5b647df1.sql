-- ─── Blocked senders: recipients can block specific senders ───
CREATE TABLE public.blocked_senders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id)
);

GRANT SELECT, INSERT ON public.blocked_senders TO authenticated;
GRANT ALL ON public.blocked_senders TO service_role;

ALTER TABLE public.blocked_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can block as themselves"
  ON public.blocked_senders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY "Users can view their own blocks"
  ON public.blocked_senders FOR SELECT TO authenticated
  USING (auth.uid() = blocker_user_id);

-- ─── Ment reports: recipients report a Ment for review ───
CREATE TABLE public.ment_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_ment_id uuid,
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id uuid,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.ment_reports TO authenticated;
GRANT ALL ON public.ment_reports TO service_role;

ALTER TABLE public.ment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can insert their own reports"
  ON public.ment_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

-- No SELECT/UPDATE/DELETE policies: reports are readable/manageable by service role only.

-- ─── Lock down direct client writes of compliments to sent_ments ───
-- Custom compliments may now ONLY be inserted via the validate-custom-ment
-- Edge Function (service role). Remove the browser INSERT path entirely.
DROP POLICY IF EXISTS "Users can insert own sent ments" ON public.sent_ments;

-- =====================================================================
-- 1. PROFILES — drop broad reads, keep self-read, add public-safe RPC
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can view profile display names" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Keep: "Users can view own profile", "Users can update own profile", "Users can insert own profile"

-- Safe view for cross-user display name / avatar lookups
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Because security_invoker=true respects RLS, add a SELECT policy that
-- only exposes the safe columns to everyone (the view restricts columns).
CREATE POLICY "Public can view display name and avatar"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);

-- Wait — that re-exposes all columns. Instead, switch view to SECURITY DEFINER
-- via a function. Drop the policy and use an RPC pattern.
DROP POLICY "Public can view display name and avatar" ON public.profiles;
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, display_name, avatar_url
  FROM public.profiles
  WHERE id = ANY(_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

-- =====================================================================
-- 2. SENT_MENTS — drop public bulk read; add reveal RPC
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can view sent ments by ID" ON public.sent_ments;

-- Add recipient-scoped policy: a logged-in user whose email matches recipient_email
CREATE POLICY "Recipients can view their ments"
ON public.sent_ments FOR SELECT
TO authenticated
USING (lower(recipient_email) = lower((auth.jwt() ->> 'email')::text));

-- Public reveal RPC: returns ONLY safe fields, requires exact ID
CREATE OR REPLACE FUNCTION public.get_ment_for_reveal(_ment_id uuid)
RETURNS TABLE(
  id uuid,
  compliment_text text,
  category text,
  sent_at timestamptz,
  sender_id uuid,
  recipient_expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, compliment_text, category, sent_at, sender_id, recipient_expires_at
  FROM public.sent_ments
  WHERE id = _ment_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ment_for_reveal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_ment_for_reveal(uuid) TO anon, authenticated;

-- =====================================================================
-- 3. MENT_CHAINS — drop public active read, add safe reveal/top RPCs
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can view active chains" ON public.ment_chains;

-- Public reveal for /chain/:id — returns chain info WITHOUT exposing current_holder email
CREATE OR REPLACE FUNCTION public.get_chain_for_reveal(_chain_id uuid)
RETURNS TABLE(
  chain_id uuid,
  chain_name text,
  share_count integer,
  tier text,
  expires_at timestamptz,
  started_by uuid,
  status text,
  created_at timestamptz,
  links_count integer,
  is_holder_uuid boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    chain_id,
    chain_name,
    share_count,
    tier,
    expires_at,
    started_by,
    status,
    created_at,
    links_count,
    (current_holder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') AS is_holder_uuid
  FROM public.ment_chains
  WHERE chain_id = _chain_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_chain_for_reveal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_chain_for_reveal(uuid) TO anon, authenticated;

-- Leaderboard / top-chains RPC — only safe fields
CREATE OR REPLACE FUNCTION public.get_top_chains(_since timestamptz DEFAULT NULL, _limit integer DEFAULT 10)
RETURNS TABLE(
  chain_id uuid,
  chain_name text,
  share_count integer,
  tier text,
  links_count integer,
  created_at timestamptz,
  started_by uuid,
  status text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT chain_id, chain_name, share_count, tier, links_count, created_at, started_by, status
  FROM public.ment_chains
  WHERE (_since IS NULL OR created_at >= _since)
  ORDER BY share_count DESC NULLS LAST, links_count DESC NULLS LAST
  LIMIT GREATEST(_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.get_top_chains(timestamptz, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_top_chains(timestamptz, integer) TO anon, authenticated;

-- =====================================================================
-- 4. MENT_CHAINS UPDATE — replace WITH CHECK true + trigger for immutables
-- =====================================================================
DROP POLICY IF EXISTS "Users can update chains they started or are current holder" ON public.ment_chains;

CREATE POLICY "Users can update chains they started or are current holder"
ON public.ment_chains FOR UPDATE
TO authenticated
USING ((auth.uid() = started_by) OR (current_holder = (auth.uid())::text))
WITH CHECK ((auth.uid() = started_by) OR (current_holder = (auth.uid())::text));

-- Trigger preventing change to immutable fields
CREATE OR REPLACE FUNCTION public.ment_chains_protect_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.started_by IS DISTINCT FROM OLD.started_by THEN
    RAISE EXCEPTION 'started_by is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable';
  END IF;
  IF NEW.chain_id IS DISTINCT FROM OLD.chain_id THEN
    RAISE EXCEPTION 'chain_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ment_chains_protect_immutable_trg ON public.ment_chains;
CREATE TRIGGER ment_chains_protect_immutable_trg
BEFORE UPDATE ON public.ment_chains
FOR EACH ROW EXECUTE FUNCTION public.ment_chains_protect_immutable();

-- =====================================================================
-- 5. EMAIL_QUEUE / ERROR_LOG — explicit deny for users
-- =====================================================================
CREATE POLICY "Block user reads of email_queue"
ON public.email_queue FOR SELECT
TO anon, authenticated USING (false);

CREATE POLICY "Block user writes of email_queue"
ON public.email_queue FOR INSERT
TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Block user updates of email_queue"
ON public.email_queue FOR UPDATE
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Block user deletes of email_queue"
ON public.email_queue FOR DELETE
TO anon, authenticated USING (false);

CREATE POLICY "Block user reads of error_log"
ON public.error_log FOR SELECT
TO anon, authenticated USING (false);

CREATE POLICY "Block user writes of error_log"
ON public.error_log FOR INSERT
TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Block user updates of error_log"
ON public.error_log FOR UPDATE
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Block user deletes of error_log"
ON public.error_log FOR DELETE
TO anon, authenticated USING (false);

-- =====================================================================
-- 6. recipient_login_tokens — also block users (service-role only)
-- =====================================================================
CREATE POLICY "Block user reads of recipient_login_tokens"
ON public.recipient_login_tokens FOR SELECT
TO anon, authenticated USING (false);

CREATE POLICY "Block user writes of recipient_login_tokens"
ON public.recipient_login_tokens FOR INSERT
TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Block user updates of recipient_login_tokens"
ON public.recipient_login_tokens FOR UPDATE
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Block user deletes of recipient_login_tokens"
ON public.recipient_login_tokens FOR DELETE
TO anon, authenticated USING (false);

-- =====================================================================
-- 7. SECURITY DEFINER hardening — revoke execute from anon where not needed
-- =====================================================================
-- These need to remain callable internally but not by anonymous users
REVOKE EXECUTE ON FUNCTION public.award_mint_to_email(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_chains_for_user(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.extend_chain_timer(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_chain_participant(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_participated_in_chain(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_participated_chain_ids(uuid, text) FROM anon, public;

-- get_popular_compliments and contains_blocked_word are safe to remain
-- accessible since they don't expose PII.

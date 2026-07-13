-- ─────────────────────────────────────────────────────────────
-- Saved Groups + Group Send + Rate Limiting + Configurable base URL support
-- ─────────────────────────────────────────────────────────────

-- 1. contact_groups ------------------------------------------------
CREATE TABLE public.contact_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_groups TO authenticated;
GRANT ALL ON public.contact_groups TO service_role;

ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own groups"
  ON public.contact_groups FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_contact_groups_updated_at
  BEFORE UPDATE ON public.contact_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. contact_group_members ----------------------------------------
CREATE TABLE public.contact_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.contact_groups(id) ON DELETE CASCADE,
  contact_email text NOT NULL,
  contact_name text,
  contact_phone text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, contact_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_group_members TO authenticated;
GRANT ALL ON public.contact_group_members TO service_role;

ALTER TABLE public.contact_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage members of own groups"
  ON public.contact_group_members FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contact_groups g WHERE g.id = group_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contact_groups g WHERE g.id = group_id AND g.user_id = auth.uid()));

CREATE INDEX idx_contact_group_members_group ON public.contact_group_members(group_id);

-- 3. send_events (rate-limit ledger, written by edge functions) ----
CREATE TABLE public.send_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  send_type text NOT NULL,               -- 'single' | 'group' | 'chain'
  recipient_count integer NOT NULL DEFAULT 1,
  channel text NOT NULL DEFAULT 'email', -- 'email' | 'sms'
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.send_events TO service_role;

ALTER TABLE public.send_events ENABLE ROW LEVEL SECURITY;

-- Users may read their own send history (for showing remaining daily allowance).
GRANT SELECT ON public.send_events TO authenticated;
CREATE POLICY "Users read own send events"
  ON public.send_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_send_events_user_day ON public.send_events(user_id, created_at);

-- 4. group columns on sent_ments ----------------------------------
ALTER TABLE public.sent_ments
  ADD COLUMN group_id uuid REFERENCES public.contact_groups(id) ON DELETE SET NULL,
  ADD COLUMN group_send_id uuid;

CREATE INDEX idx_sent_ments_group_send ON public.sent_ments(group_send_id);

-- 5. is_established_account: 7+ days old AND zero reports against them
CREATE OR REPLACE FUNCTION public.is_established_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (u.created_at <= now() - interval '7 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.ment_reports r
      LEFT JOIN public.sent_ments sm ON sm.id = r.reported_ment_id
      WHERE COALESCE(r.reported_user_id, sm.sender_id) = _user_id
    ),
    false
  )
  FROM auth.users u
  WHERE u.id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.is_established_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_established_account(uuid) TO service_role, authenticated;

-- 6. check_and_record_send: atomic rate-limit gate + ledger insert
--    Returns jsonb { allowed: bool, error_code?: text }.
--    error_code ∈ 'per_send' | 'daily_sends' | 'daily_recipients' | 'daily_sms'
CREATE OR REPLACE FUNCTION public.check_and_record_send(
  _user_id uuid,
  _send_type text,
  _recipient_count integer,
  _channel text DEFAULT 'email'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_established boolean;
  v_max_actions int;
  v_max_recipients int;
  v_max_per_send int;
  v_max_sms int;
  v_actions_today int;
  v_recipients_today int;
  v_sms_today int;
  v_count int := GREATEST(COALESCE(_recipient_count, 1), 1);
BEGIN
  v_established := public.is_established_account(_user_id);

  IF v_established THEN
    v_max_actions := 30; v_max_recipients := 100; v_max_per_send := 25; v_max_sms := 30;
  ELSE
    v_max_actions := 10; v_max_recipients := 25;  v_max_per_send := 15; v_max_sms := 15;
  END IF;

  -- Per-send recipient cap
  IF v_count > v_max_per_send THEN
    RETURN jsonb_build_object('allowed', false, 'error_code', 'per_send', 'max_per_send', v_max_per_send);
  END IF;

  SELECT COUNT(*), COALESCE(SUM(recipient_count), 0)
    INTO v_actions_today, v_recipients_today
  FROM public.send_events
  WHERE user_id = _user_id AND created_at >= date_trunc('day', now());

  IF v_actions_today + 1 > v_max_actions THEN
    RETURN jsonb_build_object('allowed', false, 'error_code', 'daily_sends');
  END IF;

  IF v_recipients_today + v_count > v_max_recipients THEN
    RETURN jsonb_build_object('allowed', false, 'error_code', 'daily_recipients');
  END IF;

  IF _channel = 'sms' THEN
    SELECT COALESCE(SUM(recipient_count), 0) INTO v_sms_today
    FROM public.send_events
    WHERE user_id = _user_id AND channel = 'sms' AND created_at >= date_trunc('day', now());

    IF v_sms_today + v_count > v_max_sms THEN
      RETURN jsonb_build_object('allowed', false, 'error_code', 'daily_sms');
    END IF;
  END IF;

  INSERT INTO public.send_events (user_id, send_type, recipient_count, channel)
  VALUES (_user_id, COALESCE(_send_type, 'single'), v_count, COALESCE(_channel, 'email'));

  RETURN jsonb_build_object('allowed', true, 'established', v_established);
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_record_send(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_record_send(uuid, text, integer, text) TO service_role;

-- 7. get_send_limits: read-only usage snapshot for the logged-in user
CREATE OR REPLACE FUNCTION public.get_send_limits()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_established boolean;
  v_max_actions int;
  v_max_recipients int;
  v_max_per_send int;
  v_actions_today int;
  v_recipients_today int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_established := public.is_established_account(uid);
  IF v_established THEN
    v_max_actions := 30; v_max_recipients := 100; v_max_per_send := 25;
  ELSE
    v_max_actions := 10; v_max_recipients := 25; v_max_per_send := 15;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(recipient_count), 0)
    INTO v_actions_today, v_recipients_today
  FROM public.send_events
  WHERE user_id = uid AND created_at >= date_trunc('day', now());

  RETURN jsonb_build_object(
    'established', v_established,
    'max_actions', v_max_actions,
    'max_recipients', v_max_recipients,
    'max_per_send', v_max_per_send,
    'actions_today', v_actions_today,
    'recipients_today', v_recipients_today
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_send_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_send_limits() TO authenticated;

-- 8. admin_get_do_not_contact: read-only list for the admin dashboard
CREATE OR REPLACE FUNCTION public.admin_get_do_not_contact()
RETURNS TABLE(email text, opted_out_at timestamptz, source text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.email, d.opted_out_at, d.source
  FROM public.do_not_contact d
  WHERE public.is_app_admin()
  ORDER BY d.opted_out_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_get_do_not_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_do_not_contact() TO authenticated;

-- 9. Extend get_ment_for_reveal with group context (recipient-facing display)
DROP FUNCTION IF EXISTS public.get_ment_for_reveal(uuid);

CREATE FUNCTION public.get_ment_for_reveal(_ment_id uuid)
RETURNS TABLE(
  id uuid,
  compliment_text text,
  category text,
  sent_at timestamptz,
  sender_id uuid,
  recipient_expires_at timestamptz,
  group_id uuid,
  group_send_id uuid,
  group_name text,
  other_recipient_names text[],
  other_recipient_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.compliment_text,
    sm.category,
    sm.sent_at,
    sm.sender_id,
    sm.recipient_expires_at,
    sm.group_id,
    sm.group_send_id,
    (SELECT cg.name FROM public.contact_groups cg WHERE cg.id = sm.group_id) AS group_name,
    CASE WHEN sm.group_send_id IS NULL THEN NULL
      ELSE (
        SELECT array_agg(nm) FROM (
          SELECT split_part(COALESCE(gm.contact_name, p.display_name), ' ', 1) AS nm
          FROM public.sent_ments o
          LEFT JOIN public.contact_group_members gm
            ON gm.group_id = sm.group_id AND lower(gm.contact_email) = lower(o.recipient_email)
          LEFT JOIN auth.users au ON lower(au.email) = lower(o.recipient_email)
          LEFT JOIN public.profiles p ON p.id = au.id
          WHERE o.group_send_id = sm.group_send_id
            AND o.id <> sm.id
            AND COALESCE(gm.contact_name, p.display_name) IS NOT NULL
          LIMIT 20
        ) sub
      )
    END AS other_recipient_names,
    CASE WHEN sm.group_send_id IS NULL THEN 0
      ELSE GREATEST((SELECT count(*)::int FROM public.sent_ments o2 WHERE o2.group_send_id = sm.group_send_id) - 1, 0)
    END AS other_recipient_count
  FROM public.sent_ments sm
  WHERE sm.id = _ment_id
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ment_for_reveal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_ment_for_reveal(uuid) TO anon, authenticated;

-- ── Ban flag on profiles ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

-- ── Admin check (hardcoded list of Donna's accounts) ──
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IN (
    '2ed84311-c745-4915-905c-ddbf847994e7'::uuid,  -- info@mentshop.com
    '83e6e380-5042-4fcd-b504-8e040f3dff3b'::uuid,  -- brentanddonna@yahoo.com
    'de4ed14c-de2c-4b93-bb4b-1cbcf94ff150'::uuid   -- bdhp@gmail.com
  );
$$;

-- ── All reports, joined with sender / reporter / compliment details ──
CREATE OR REPLACE FUNCTION public.admin_get_reports()
RETURNS TABLE(
  id uuid,
  status text,
  reason text,
  created_at timestamptz,
  reported_ment_id uuid,
  compliment_text text,
  sender_id uuid,
  sender_name text,
  sender_email text,
  sender_banned boolean,
  reporter_id uuid,
  reporter_name text,
  reporter_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    r.id,
    r.status,
    r.reason,
    r.created_at,
    r.reported_ment_id,
    sm.compliment_text,
    COALESCE(r.reported_user_id, sm.sender_id) AS sender_id,
    sp.display_name AS sender_name,
    su.email::text AS sender_email,
    COALESCE(sp.is_banned, false) AS sender_banned,
    r.reporter_user_id AS reporter_id,
    rp.display_name AS reporter_name,
    ru.email::text AS reporter_email
  FROM public.ment_reports r
  LEFT JOIN public.sent_ments sm ON sm.id = r.reported_ment_id
  LEFT JOIN public.profiles sp ON sp.id = COALESCE(r.reported_user_id, sm.sender_id)
  LEFT JOIN auth.users su ON su.id = COALESCE(r.reported_user_id, sm.sender_id)
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_user_id
  LEFT JOIN auth.users ru ON ru.id = r.reporter_user_id
  WHERE public.is_app_admin()
  ORDER BY r.created_at DESC;
$$;

-- ── Content filter log ──
CREATE OR REPLACE FUNCTION public.admin_get_content_blocks(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid,
  blocked_text text,
  trigger_term text,
  match_type text,
  created_at timestamptz,
  user_id uuid,
  user_name text,
  user_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    b.id,
    b.blocked_text,
    b.trigger_term,
    b.match_type,
    b.created_at,
    b.user_id,
    p.display_name AS user_name,
    u.email::text AS user_email
  FROM public.content_block_log b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN auth.users u ON u.id = b.user_id
  WHERE public.is_app_admin()
  ORDER BY b.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
$$;

-- ── Currently banned users ──
CREATE OR REPLACE FUNCTION public.admin_get_banned_users()
RETURNS TABLE(
  id uuid,
  display_name text,
  email text,
  banned_at timestamptz,
  report_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    p.display_name,
    u.email::text AS email,
    p.banned_at,
    (SELECT count(*) FROM public.ment_reports r WHERE r.reported_user_id = p.id) AS report_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.is_app_admin() AND p.is_banned = true
  ORDER BY p.banned_at DESC NULLS LAST;
$$;

-- ── Update report status ──
CREATE OR REPLACE FUNCTION public.admin_set_report_status(_report_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _status NOT IN ('pending', 'reviewed', 'closed', 'actioned') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.ment_reports SET status = _status WHERE id = _report_id;
END;
$$;

-- ── Ban a sender (and mark the report actioned) ──
CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid, _report_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles SET is_banned = true, banned_at = now() WHERE id = _user_id;
  IF _report_id IS NOT NULL THEN
    UPDATE public.ment_reports SET status = 'actioned' WHERE id = _report_id;
  END IF;
END;
$$;

-- ── Unban a sender ──
CREATE OR REPLACE FUNCTION public.admin_unban_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles SET is_banned = false, banned_at = NULL WHERE id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_content_blocks(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_banned_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_report_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;

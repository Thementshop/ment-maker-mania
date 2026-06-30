CREATE OR REPLACE FUNCTION public.is_blocked_by_email(_sender uuid, _recipient_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_senders bs
    JOIN auth.users u ON u.id = bs.blocker_user_id
    WHERE bs.blocked_user_id = _sender
      AND lower(u.email) = lower(_recipient_email)
  );
$$;

-- Backend-only: never callable from the browser / anon sessions.
REVOKE ALL ON FUNCTION public.is_blocked_by_email(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_blocked_by_email(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.is_blocked_by_email(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_by_email(uuid, text) TO service_role;
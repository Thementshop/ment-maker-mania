
CREATE OR REPLACE FUNCTION public.is_chain_participant(_chain_id uuid, _identifier text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_emails text[];
  check_value text := lower(trim(_identifier));
BEGIN
  SELECT array_agg(DISTINCT email) INTO participant_emails
  FROM (
    -- Emails for UUID-based passed_by values
    SELECT lower(au.email) as email
    FROM chain_links cl
    JOIN auth.users au ON au.id = cl.passed_by
    WHERE cl.chain_id = _chain_id
    UNION
    -- passed_to values that look like emails
    SELECT lower(cl.passed_to) as email
    FROM chain_links cl
    WHERE cl.chain_id = _chain_id AND cl.passed_to LIKE '%@%'
    UNION
    -- Emails for UUID-based passed_to values
    SELECT lower(au.email) as email
    FROM chain_links cl
    JOIN auth.users au ON au.id::text = cl.passed_to
    WHERE cl.chain_id = _chain_id
    UNION
    -- Chain starter's email
    SELECT lower(au.email) as email
    FROM ment_chains mc
    JOIN auth.users au ON au.id = mc.started_by
    WHERE mc.chain_id = _chain_id
  ) sub
  WHERE email IS NOT NULL;

  RETURN check_value = ANY(participant_emails);
END;
$$;

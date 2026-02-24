CREATE OR REPLACE FUNCTION public.claim_chains_for_user(claiming_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  claimed_count integer;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = claiming_user_id;
  
  IF user_email IS NULL THEN
    RETURN 0;
  END IF;
  
  UPDATE ment_chains
  SET current_holder = claiming_user_id::text
  WHERE lower(current_holder) = lower(user_email)
    AND status = 'active';
  
  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  RETURN claimed_count;
END;
$$;
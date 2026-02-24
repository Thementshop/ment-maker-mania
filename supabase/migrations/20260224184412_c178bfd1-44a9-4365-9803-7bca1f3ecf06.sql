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
  
  -- Update ment_chains current_holder from email to UUID
  UPDATE ment_chains
  SET current_holder = claiming_user_id::text
  WHERE lower(current_holder) = lower(user_email)
    AND status = 'active';
  
  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  
  -- Also update chain_links.passed_to from email to UUID so RLS works
  IF claimed_count > 0 THEN
    UPDATE chain_links
    SET passed_to = claiming_user_id::text
    WHERE lower(passed_to) = lower(user_email);
  END IF;
  
  RETURN claimed_count;
END;
$$;
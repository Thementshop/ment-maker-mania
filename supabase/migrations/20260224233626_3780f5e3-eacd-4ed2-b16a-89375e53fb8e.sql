
CREATE OR REPLACE FUNCTION public.claim_chains_for_user(claiming_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
  claimed_count integer;
  candidate record;
  start_ts timestamptz := clock_timestamp();
BEGIN
  RAISE LOG '[ClaimDebug] START claiming_user_id=%, ts=%', claiming_user_id, start_ts;

  SELECT email INTO user_email FROM auth.users WHERE id = claiming_user_id;
  
  RAISE LOG '[ClaimDebug] Resolved email=% for user=%', user_email, claiming_user_id;

  IF user_email IS NULL THEN
    RAISE LOG '[ClaimDebug] No email found, returning 0';
    RETURN 0;
  END IF;

  -- Log candidate chains before update
  FOR candidate IN
    SELECT chain_id, chain_name, status, current_holder
    FROM ment_chains
    WHERE lower(current_holder) = lower(user_email) AND status = 'active'
  LOOP
    RAISE LOG '[ClaimDebug] Candidate chain: id=%, name=%, status=%, holder=%',
      candidate.chain_id, candidate.chain_name, candidate.status, candidate.current_holder;
  END LOOP;
  
  -- Update ment_chains current_holder from email to UUID
  UPDATE ment_chains
  SET current_holder = claiming_user_id::text
  WHERE lower(current_holder) = lower(user_email)
    AND status = 'active';
  
  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  
  RAISE LOG '[ClaimDebug] Updated % ment_chains rows', claimed_count;

  -- Also update chain_links.passed_to from email to UUID so RLS works
  IF claimed_count > 0 THEN
    UPDATE chain_links
    SET passed_to = claiming_user_id::text
    WHERE lower(passed_to) = lower(user_email);
    
    RAISE LOG '[ClaimDebug] Updated chain_links.passed_to for email=%', user_email;
  END IF;
  
  RAISE LOG '[ClaimDebug] DONE claimed=%, elapsed_ms=%', claimed_count, extract(milliseconds from clock_timestamp() - start_ts);

  RETURN claimed_count;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[ClaimDebug] ERROR: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  RETURN 0;
END;
$function$;

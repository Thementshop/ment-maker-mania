
CREATE OR REPLACE FUNCTION public.extend_single_ment_timer(_ment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  current_tokens int;
  unlimited_active boolean := false;
  new_expiry timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT (pause_tokens_unlimited = true AND pause_tokens_unlimited_expires_at > now())
    INTO unlimited_active
  FROM profiles WHERE id = uid;

  IF NOT unlimited_active THEN
    SELECT pause_tokens INTO current_tokens FROM user_game_state WHERE user_id = uid;
    IF current_tokens IS NULL OR current_tokens <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_tokens');
    END IF;
  END IF;

  UPDATE sent_ments
  SET recipient_expires_at = COALESCE(recipient_expires_at, now()) + INTERVAL '48 hours'
  WHERE id = _ment_id
  RETURNING recipient_expires_at INTO new_expiry;

  IF new_expiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ment_not_found');
  END IF;

  IF NOT unlimited_active THEN
    UPDATE user_game_state
    SET pause_tokens = pause_tokens - 1,
        total_tokens_used = COALESCE(total_tokens_used, 0) + 1
    WHERE user_id = uid;

    UPDATE profiles
    SET pause_tokens = GREATEST(0, COALESCE(pause_tokens, 0) - 1)
    WHERE id = uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_expires_at', new_expiry,
    'unlimited', unlimited_active,
    'tokens_remaining', CASE WHEN unlimited_active THEN NULL ELSE current_tokens - 1 END
  );
END;
$function$;

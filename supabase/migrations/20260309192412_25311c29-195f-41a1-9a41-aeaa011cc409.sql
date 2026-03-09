
CREATE OR REPLACE FUNCTION public.award_mint_to_email(_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = lower(_email);
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;
  UPDATE user_game_state SET jar_count = jar_count + 1 WHERE user_id = target_user_id;
  RETURN FOUND;
END;
$$;

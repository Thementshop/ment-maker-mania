-- Add recipient timer column to sent_ments for the 48-hour single-ment window
ALTER TABLE public.sent_ments
  ADD COLUMN IF NOT EXISTS recipient_expires_at TIMESTAMPTZ;

-- Backfill existing rows (48h from sent_at)
UPDATE public.sent_ments
SET recipient_expires_at = COALESCE(sent_at, now()) + INTERVAL '48 hours'
WHERE recipient_expires_at IS NULL;

-- Default for new rows
ALTER TABLE public.sent_ments
  ALTER COLUMN recipient_expires_at SET DEFAULT (now() + INTERVAL '48 hours');

-- RPC: extend a single ment's recipient timer by 48 hours, decrement caller's pause tokens
CREATE OR REPLACE FUNCTION public.extend_single_ment_timer(_ment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  current_tokens int;
  new_expiry timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT pause_tokens INTO current_tokens
  FROM user_game_state WHERE user_id = uid;

  IF current_tokens IS NULL OR current_tokens <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_tokens');
  END IF;

  UPDATE sent_ments
  SET recipient_expires_at = COALESCE(recipient_expires_at, now()) + INTERVAL '48 hours'
  WHERE id = _ment_id
  RETURNING recipient_expires_at INTO new_expiry;

  IF new_expiry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ment_not_found');
  END IF;

  UPDATE user_game_state
  SET pause_tokens = pause_tokens - 1,
      total_tokens_used = COALESCE(total_tokens_used, 0) + 1
  WHERE user_id = uid;

  -- Mirror to profiles.pause_tokens for consistency
  UPDATE profiles
  SET pause_tokens = GREATEST(0, COALESCE(pause_tokens, 0) - 1)
  WHERE id = uid;

  RETURN jsonb_build_object('success', true, 'new_expires_at', new_expiry, 'tokens_remaining', current_tokens - 1);
END;
$$;
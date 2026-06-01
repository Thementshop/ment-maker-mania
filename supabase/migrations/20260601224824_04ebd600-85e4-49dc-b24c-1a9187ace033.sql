ALTER TABLE public.sent_ments
  ADD COLUMN IF NOT EXISTS recipient_phone text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sent_ments_recipient_phone
  ON public.sent_ments (recipient_phone);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  unclaimed_count integer := 0;
  new_phone text := NULLIF(trim(COALESCE(NEW.phone, '')), '');
BEGIN
  INSERT INTO public.profiles (id, display_name, pause_tokens)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 5);

  -- Count Ments sent to this email OR phone before the account existed
  SELECT count(*) INTO unclaimed_count
  FROM public.sent_ments
  WHERE claimed_by IS NULL
    AND (
      lower(recipient_email) = lower(NEW.email)
      OR (new_phone IS NOT NULL AND recipient_phone = new_phone)
    );

  -- Game state jar reflects: 1 signup mint + 1 per unclaimed Ment
  INSERT INTO public.user_game_state (user_id, jar_count, total_sent, current_level, pause_tokens)
  VALUES (NEW.id, 1 + unclaimed_count, 0, 1, 5);

  -- Signup mint
  INSERT INTO public.mint_transactions (user_id, amount, reason)
  VALUES (NEW.id, 1, 'signup');

  -- Credit one 'receive' mint per unclaimed Ment, then mark them claimed
  IF unclaimed_count > 0 THEN
    INSERT INTO public.mint_transactions (user_id, amount, reason)
    SELECT NEW.id, 1, 'receive'
    FROM public.sent_ments
    WHERE claimed_by IS NULL
      AND (
        lower(recipient_email) = lower(NEW.email)
        OR (new_phone IS NOT NULL AND recipient_phone = new_phone)
      );

    UPDATE public.sent_ments
    SET claimed_by = NEW.id, claimed_at = now()
    WHERE claimed_by IS NULL
      AND (
        lower(recipient_email) = lower(NEW.email)
        OR (new_phone IS NOT NULL AND recipient_phone = new_phone)
      );
  END IF;

  RETURN NEW;
END;
$function$;
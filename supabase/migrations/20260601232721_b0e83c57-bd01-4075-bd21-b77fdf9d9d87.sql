CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  unclaimed_ment_count integer := 0;
  unclaimed_chain_count integer := 0;
  total_unclaimed integer := 0;
  new_phone text := NULLIF(trim(COALESCE(NEW.phone, '')), '');
BEGIN
  INSERT INTO public.profiles (id, display_name, pause_tokens)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 5);

  -- Count one-time Ments sent to this email OR phone before the account existed
  SELECT count(*) INTO unclaimed_ment_count
  FROM public.sent_ments
  WHERE claimed_by IS NULL
    AND (
      lower(recipient_email) = lower(NEW.email)
      OR (new_phone IS NOT NULL AND recipient_phone = new_phone)
    );

  -- Count chain Ments addressed to this email OR phone that have not yet been
  -- converted to a UUID (recipient had no account when the chain was started).
  -- These are credited here; claim_chains_for_user later rewrites passed_to to
  -- the new UUID, so this count can only match pre-account links.
  SELECT count(*) INTO unclaimed_chain_count
  FROM public.chain_links
  WHERE (
    lower(passed_to) = lower(NEW.email)
    OR (new_phone IS NOT NULL AND passed_to = new_phone)
  );

  total_unclaimed := unclaimed_ment_count + unclaimed_chain_count;

  -- Game state jar reflects: 1 signup mint + 1 per unclaimed Ment (one-time + chain)
  INSERT INTO public.user_game_state (user_id, jar_count, total_sent, current_level, pause_tokens)
  VALUES (NEW.id, 1 + total_unclaimed, 0, 1, 5);

  -- Signup mint
  INSERT INTO public.mint_transactions (user_id, amount, reason)
  VALUES (NEW.id, 1, 'signup');

  -- Credit one 'receive' mint per unclaimed one-time Ment, then mark them claimed
  IF unclaimed_ment_count > 0 THEN
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

  -- Credit one 'receive' mint per unclaimed chain Ment
  IF unclaimed_chain_count > 0 THEN
    INSERT INTO public.mint_transactions (user_id, amount, reason)
    SELECT NEW.id, 1, 'receive'
    FROM public.chain_links
    WHERE (
      lower(passed_to) = lower(NEW.email)
      OR (new_phone IS NOT NULL AND passed_to = new_phone)
    );
  END IF;

  RETURN NEW;
END;
$function$;
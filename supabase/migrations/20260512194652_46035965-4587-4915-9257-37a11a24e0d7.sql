-- Update new user handler to grant 1 starting mint (was 25) and seed mint_transactions
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, pause_tokens)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 5);

  INSERT INTO public.user_game_state (user_id, jar_count, total_sent, current_level, pause_tokens)
  VALUES (NEW.id, 1, 0, 1, 5);

  INSERT INTO public.mint_transactions (user_id, amount, reason)
  VALUES (NEW.id, 1, 'signup');

  RETURN NEW;
END;
$function$;

-- Reset all existing users to exactly 1 signup mint
DELETE FROM public.mint_transactions;

INSERT INTO public.mint_transactions (user_id, amount, reason)
SELECT id, 1, 'signup' FROM auth.users;

-- Sync user_game_state.jar_count to 1 for all existing users
UPDATE public.user_game_state SET jar_count = 1;
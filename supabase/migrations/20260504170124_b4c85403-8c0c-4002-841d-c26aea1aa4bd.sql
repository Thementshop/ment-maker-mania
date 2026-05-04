-- Add pause_tokens column to profiles (per request) — primary store remains user_game_state
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pause_tokens INTEGER NOT NULL DEFAULT 5;

-- Update new user handler to grant 5 pause tokens (was 3) and 25 mints
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
  VALUES (NEW.id, 25, 0, 1, 5);

  RETURN NEW;
END;
$function$;
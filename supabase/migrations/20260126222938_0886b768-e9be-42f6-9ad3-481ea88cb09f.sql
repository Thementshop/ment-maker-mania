-- Add pause token tracking columns to user_game_state
-- Note: pause_tokens column was already added, we need to add tracking columns
ALTER TABLE public.user_game_state
ADD COLUMN IF NOT EXISTS last_free_token_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER NOT NULL DEFAULT 0;

-- Update existing rows to have the default free token date
UPDATE public.user_game_state
SET last_free_token_date = now()
WHERE last_free_token_date IS NULL;

-- Set default pause_tokens to 1 for new users (modify the default)
ALTER TABLE public.user_game_state
ALTER COLUMN pause_tokens SET DEFAULT 1;

-- Update existing users who have 0 tokens to get their first free one
UPDATE public.user_game_state
SET pause_tokens = 1
WHERE pause_tokens = 0;
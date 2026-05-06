
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pause_tokens_unlimited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_tokens_unlimited_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS mint_boost_last_purchased_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  user_id uuid,
  price_id text,
  amount_cents integer,
  raw jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment events"
  ON public.payment_events FOR SELECT
  USING (auth.uid() = user_id);

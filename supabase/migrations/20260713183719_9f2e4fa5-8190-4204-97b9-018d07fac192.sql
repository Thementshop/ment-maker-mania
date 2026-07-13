-- ── New table: phone_verification_codes ──
CREATE TABLE public.phone_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false
);

GRANT SELECT, UPDATE ON public.phone_verification_codes TO authenticated;
GRANT ALL ON public.phone_verification_codes TO service_role;

ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own verification codes"
  ON public.phone_verification_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own verification codes"
  ON public.phone_verification_codes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_phone_verification_lookup
  ON public.phone_verification_codes (user_id, phone_number, verified);

-- ── Existing table changes: profiles ──
ALTER TABLE public.profiles
  ADD COLUMN phone_number text,
  ADD COLUMN phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN phone_verified_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_number_unique UNIQUE (phone_number);

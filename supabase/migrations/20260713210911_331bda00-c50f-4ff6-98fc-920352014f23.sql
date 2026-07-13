-- ─── do_not_contact: permanent opt-out list ───
CREATE TABLE public.do_not_contact (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  opt_out_token text NOT NULL UNIQUE,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'email_link'
);

GRANT ALL ON public.do_not_contact TO service_role;

ALTER TABLE public.do_not_contact ENABLE ROW LEVEL SECURITY;
-- No policies: no anon/authenticated access. Only service_role (edge functions) can read/write.

CREATE INDEX idx_do_not_contact_email ON public.do_not_contact (lower(email));

-- ─── email_opt_out_tokens: per-email unsubscribe token ───
CREATE TABLE public.email_opt_out_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_opt_out_tokens TO service_role;

ALTER TABLE public.email_opt_out_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: no anon/authenticated access. Only service_role (edge functions) can read/write.

CREATE INDEX idx_email_opt_out_tokens_email ON public.email_opt_out_tokens (lower(email));
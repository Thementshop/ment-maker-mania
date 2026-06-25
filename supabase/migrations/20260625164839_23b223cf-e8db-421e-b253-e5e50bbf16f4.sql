CREATE TABLE public.content_block_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocked_text text NOT NULL,
  trigger_term text,
  match_type text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.content_block_log TO service_role;

ALTER TABLE public.content_block_log ENABLE ROW LEVEL SECURITY;

-- No client read/write policies: the table is written only via the SECURITY DEFINER
-- function below and read only by the service role / backend.

CREATE OR REPLACE FUNCTION public.log_content_block(
  _blocked_text text,
  _trigger_term text,
  _match_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.content_block_log (blocked_text, trigger_term, match_type, user_id)
  VALUES (
    left(coalesce(_blocked_text, ''), 500),
    left(coalesce(_trigger_term, ''), 200),
    coalesce(_match_type, 'unknown'),
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_content_block(text, text, text) TO anon, authenticated;
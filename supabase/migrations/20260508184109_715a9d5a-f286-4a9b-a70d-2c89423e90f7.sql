-- 1. Create mint_transactions table (single source of truth for mints earned)
CREATE TABLE public.mint_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mint_transactions_user ON public.mint_transactions(user_id);
CREATE INDEX idx_mint_transactions_user_reason ON public.mint_transactions(user_id, reason);

ALTER TABLE public.mint_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mint transactions"
  ON public.mint_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage mint transactions"
  ON public.mint_transactions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 2. Auto-record a mint_transaction row for each ment sent (single ments)
CREATE OR REPLACE FUNCTION public.record_mint_for_sent_ment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mint_transactions (user_id, amount, reason)
  VALUES (NEW.sender_id, 1, 'send');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sent_ments_mint
AFTER INSERT ON public.sent_ments
FOR EACH ROW EXECUTE FUNCTION public.record_mint_for_sent_ment();

-- 3. Auto-record a mint_transaction row for each chain link (one per recipient)
CREATE OR REPLACE FUNCTION public.record_mint_for_chain_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.passed_by IS NOT NULL THEN
    INSERT INTO public.mint_transactions (user_id, amount, reason)
    VALUES (NEW.passed_by, 1, 'send');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chain_links_mint
AFTER INSERT ON public.chain_links
FOR EACH ROW EXECUTE FUNCTION public.record_mint_for_chain_link();

-- 4. Backfill existing sends so current users see correct counts
INSERT INTO public.mint_transactions (user_id, amount, reason, created_at)
SELECT sender_id, 1, 'send', sent_at FROM public.sent_ments WHERE sender_id IS NOT NULL;

INSERT INTO public.mint_transactions (user_id, amount, reason, created_at)
SELECT passed_by, 1, 'send', passed_at FROM public.chain_links WHERE passed_by IS NOT NULL;
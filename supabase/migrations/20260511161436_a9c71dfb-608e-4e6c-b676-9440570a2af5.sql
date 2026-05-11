
-- Remove duplicate sent_ments triggers — edge function send-a-ment is the sole writer
DROP TRIGGER IF EXISTS trg_sent_ments_mint ON public.sent_ments;
DROP TRIGGER IF EXISTS trg_record_mint_for_sent_ment ON public.sent_ments;

-- Keep ONE chain_links trigger (chain pass flow doesn't insert mint_transactions itself)
DROP TRIGGER IF EXISTS trg_chain_links_mint ON public.chain_links;
-- trg_record_mint_for_chain_link remains as the canonical writer for chain passes

-- Dedupe mint_transactions: keep one row per (user_id, created_at)
DELETE FROM public.mint_transactions a
USING public.mint_transactions b
WHERE a.user_id = b.user_id
  AND a.created_at = b.created_at
  AND a.id > b.id;

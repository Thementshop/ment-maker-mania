-- Attach triggers so mint_transactions auto-records on every send
DROP TRIGGER IF EXISTS trg_record_mint_for_sent_ment ON public.sent_ments;
CREATE TRIGGER trg_record_mint_for_sent_ment
AFTER INSERT ON public.sent_ments
FOR EACH ROW
EXECUTE FUNCTION public.record_mint_for_sent_ment();

DROP TRIGGER IF EXISTS trg_record_mint_for_chain_link ON public.chain_links;
CREATE TRIGGER trg_record_mint_for_chain_link
AFTER INSERT ON public.chain_links
FOR EACH ROW
EXECUTE FUNCTION public.record_mint_for_chain_link();
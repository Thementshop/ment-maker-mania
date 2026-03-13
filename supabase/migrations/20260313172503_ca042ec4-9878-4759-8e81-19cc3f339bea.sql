
ALTER TABLE public.chain_links ADD COLUMN compliment_category TEXT;
ALTER TABLE public.ment_chains ADD COLUMN compliment_category TEXT;
CREATE INDEX idx_chain_links_category ON public.chain_links(compliment_category);
CREATE INDEX idx_ment_chains_category ON public.ment_chains(compliment_category);

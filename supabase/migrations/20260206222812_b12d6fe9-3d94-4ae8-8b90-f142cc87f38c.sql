-- Add broken_by column to track who let the chain expire
ALTER TABLE public.ment_chains 
ADD COLUMN broken_by text DEFAULT NULL;

-- Add index for efficient querying of broken chains by starter
CREATE INDEX idx_ment_chains_broken_status ON public.ment_chains(status, started_by) 
WHERE status = 'broken';
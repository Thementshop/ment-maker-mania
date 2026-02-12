CREATE POLICY "Chain starters can view all links in their chains"
  ON public.chain_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ment_chains 
      WHERE ment_chains.chain_id = chain_links.chain_id 
      AND ment_chains.started_by = auth.uid()
    )
  );
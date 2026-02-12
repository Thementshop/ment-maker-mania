CREATE POLICY "Current holders can view chain links"
  ON public.chain_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ment_chains 
      WHERE ment_chains.chain_id = chain_links.chain_id 
      AND ment_chains.current_holder = auth.uid()::text
    )
  );
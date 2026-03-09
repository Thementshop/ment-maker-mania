CREATE POLICY "Users can view chains they participated in"
ON ment_chains FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chain_links
    WHERE chain_links.chain_id = ment_chains.chain_id
    AND (chain_links.passed_by = auth.uid() OR chain_links.passed_to = auth.uid()::text)
  )
);
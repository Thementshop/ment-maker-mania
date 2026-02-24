
DROP POLICY "Users can view chains they started or are current holder" ON ment_chains;

CREATE POLICY "Users can view chains they started or are current holder"
  ON ment_chains FOR SELECT
  USING (
    auth.uid() = started_by
    OR current_holder = (auth.uid())::text
    OR lower(current_holder) = lower(auth.jwt()->>'email')
  );

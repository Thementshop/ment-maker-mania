
-- Drop existing UPDATE policy and recreate with explicit WITH CHECK
DROP POLICY IF EXISTS "Users can update chains they started or are current holder" ON ment_chains;

CREATE POLICY "Users can update chains they started or are current holder"
ON ment_chains
FOR UPDATE
USING ((auth.uid() = started_by) OR (current_holder = (auth.uid())::text))
WITH CHECK (true);

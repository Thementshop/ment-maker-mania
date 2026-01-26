-- Allow authenticated users to view active chains for leaderboard
-- This enables the leaderboard to show top chains without exposing user IDs
CREATE POLICY "Users can view active chains for leaderboard"
ON public.ment_chains
FOR SELECT
TO authenticated
USING (status = 'active');

-- Drop the restrictive leaderboard policy on ment_chains
DROP POLICY "Users can view active chains for leaderboard" ON public.ment_chains;

-- Recreate as permissive so anonymous users can view active chains
CREATE POLICY "Anyone can view active chains"
  ON public.ment_chains
  FOR SELECT
  TO public
  USING (status = 'active');

-- Add permissive policy on profiles for public display name lookups
CREATE POLICY "Anyone can view profile display names"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);

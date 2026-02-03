-- Allow authenticated users to view all profiles (display names)
-- This is needed for chain cards to show who started/holds a chain
CREATE POLICY "Authenticated users can view all profiles" 
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
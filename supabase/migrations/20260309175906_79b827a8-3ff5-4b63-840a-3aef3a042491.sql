-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view chains they participated in" ON ment_chains;

-- Create a security definer function to check participation without triggering RLS
CREATE OR REPLACE FUNCTION public.user_participated_in_chain(_user_id uuid, _chain_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chain_links
    WHERE chain_id = _chain_id
    AND (passed_by = _user_id OR passed_to = _user_id::text)
  )
$$;

-- Recreate the policy using the function (no recursion)
CREATE POLICY "Users can view chains they participated in"
ON ment_chains FOR SELECT
TO authenticated
USING (public.user_participated_in_chain(auth.uid(), chain_id));
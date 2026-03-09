-- Create a function to get chain_ids a user participated in (bypasses RLS on chain_links)
CREATE OR REPLACE FUNCTION public.get_participated_chain_ids(_user_id uuid, _user_email text DEFAULT '')
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT chain_id FROM chain_links
  WHERE passed_by = _user_id 
    OR passed_to = _user_id::text
    OR (length(_user_email) > 0 AND lower(passed_to) = lower(_user_email))
$$;
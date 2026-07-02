-- Contacts tables were unreachable through the Data API because they had no
-- role grants (RLS was correct, but PostgREST returns permission denied without
-- explicit GRANTs). Every policy scopes to auth.uid() = user_id, so grant to
-- authenticated and service_role only (no anon).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_contacts TO authenticated;
GRANT ALL ON public.user_contacts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_contacts TO authenticated;
GRANT ALL ON public.saved_contacts TO service_role;
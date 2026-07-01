-- Allow reporters to read their own reports
GRANT SELECT ON public.ment_reports TO authenticated;

CREATE POLICY "Reporters can view their own reports"
ON public.ment_reports
FOR SELECT
TO authenticated
USING (auth.uid() = reporter_user_id);

-- RPC: return the current user's reports with the reported compliment text,
-- bypassing sent_ments RLS via SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_my_reports()
RETURNS TABLE(
  id uuid,
  status text,
  reason text,
  created_at timestamptz,
  reported_ment_id uuid,
  compliment_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.status,
    r.reason,
    r.created_at,
    r.reported_ment_id,
    sm.compliment_text
  FROM public.ment_reports r
  LEFT JOIN public.sent_ments sm ON sm.id = r.reported_ment_id
  WHERE r.reporter_user_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_reports() TO authenticated;
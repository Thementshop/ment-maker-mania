CREATE OR REPLACE FUNCTION public.is_app_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() = 'eab629d4-d0af-4720-8c4d-753b11ab8f2e'::uuid;  -- donna@mentshop.com (sole admin)
$function$;
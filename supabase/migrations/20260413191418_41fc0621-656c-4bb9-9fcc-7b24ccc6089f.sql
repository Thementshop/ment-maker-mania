
-- Create user_contacts table
CREATE TABLE public.user_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  delivery_preference TEXT NOT NULL DEFAULT 'text',
  last_sent_at TIMESTAMP WITH TIME ZONE,
  total_ments_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Validation trigger: require at least phone or email
CREATE OR REPLACE FUNCTION public.validate_user_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL AND NEW.email IS NULL THEN
    RAISE EXCEPTION 'Contact must have at least a phone number or email address';
  END IF;
  IF NEW.delivery_preference NOT IN ('text', 'email') THEN
    RAISE EXCEPTION 'delivery_preference must be text or email';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_user_contact_trigger
BEFORE INSERT OR UPDATE ON public.user_contacts
FOR EACH ROW EXECUTE FUNCTION public.validate_user_contact();

-- Index for fast autocomplete
CREATE INDEX idx_user_contacts_user_name ON public.user_contacts (user_id, contact_name);

-- Enable RLS
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own contacts"
ON public.user_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
ON public.user_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
ON public.user_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
ON public.user_contacts FOR DELETE
USING (auth.uid() = user_id);

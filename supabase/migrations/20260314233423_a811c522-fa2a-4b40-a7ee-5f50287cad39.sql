
-- Add recipient_email and personal_note to sent_ments
ALTER TABLE sent_ments ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE sent_ments ADD COLUMN IF NOT EXISTS personal_note TEXT;

-- Create saved_contacts table
CREATE TABLE IF NOT EXISTS saved_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  times_sent INT DEFAULT 1,
  last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_contacts_user ON saved_contacts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_contacts_unique ON saved_contacts(user_id, contact_email);
ALTER TABLE saved_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contacts" ON saved_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON saved_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON saved_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON saved_contacts FOR DELETE USING (auth.uid() = user_id);

-- Create pause_token_usage table
CREATE TABLE IF NOT EXISTS pause_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chain_id UUID NOT NULL REFERENCES ment_chains(chain_id),
  used_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pause_usage_user ON pause_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_pause_usage_chain ON pause_token_usage(chain_id);
ALTER TABLE pause_token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own token usage" ON pause_token_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own token usage" ON pause_token_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update handle_new_user to give 3 pause tokens
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_game_state (user_id, jar_count, total_sent, current_level, pause_tokens)
  VALUES (NEW.id, 25, 0, 1, 3);
  
  RETURN NEW;
END;
$$;

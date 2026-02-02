-- 1. Add new columns to ment_chains table
ALTER TABLE ment_chains 
  ADD COLUMN IF NOT EXISTS chain_name TEXT,
  ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS is_queued BOOLEAN DEFAULT false;

-- 2. Create used_chain_names table to track names in use
CREATE TABLE IF NOT EXISTS used_chain_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_name TEXT UNIQUE NOT NULL,
  chain_id UUID REFERENCES ment_chains(chain_id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_used_chain_names_chain_name 
ON used_chain_names(chain_name);

-- Enable RLS on used_chain_names
ALTER TABLE used_chain_names ENABLE ROW LEVEL SECURITY;

-- RLS policies for used_chain_names - anyone can read (to check availability)
CREATE POLICY "Anyone can view used chain names"
ON used_chain_names
FOR SELECT
USING (true);

-- Only authenticated users can insert chain names they claim
CREATE POLICY "Users can insert chain names for their chains"
ON used_chain_names
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ment_chains 
    WHERE ment_chains.chain_id = used_chain_names.chain_id 
    AND ment_chains.started_by = auth.uid()
  )
);

-- 3. Create trigger function to release chain names when chain breaks
CREATE OR REPLACE FUNCTION public.release_chain_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If chain status changed from active to broken
  IF NEW.status = 'broken' AND OLD.status != 'broken' THEN
    -- Delete from used names to make it available again
    DELETE FROM used_chain_names WHERE chain_id = NEW.chain_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS on_chain_broken ON ment_chains;
CREATE TRIGGER on_chain_broken
AFTER UPDATE ON ment_chains
FOR EACH ROW
EXECUTE FUNCTION public.release_chain_name();

-- 4. Add new columns to user_game_state table
-- Note: chains_started_today already exists, adding new ones
ALTER TABLE user_game_state 
  ADD COLUMN IF NOT EXISTS last_chain_start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS broken_chains_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legendary_chains_created INTEGER DEFAULT 0;
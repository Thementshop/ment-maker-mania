-- Create ment_chains table
CREATE TABLE public.ment_chains (
  chain_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by UUID NOT NULL,
  current_holder TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  links_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  broken_at TIMESTAMP WITH TIME ZONE
);

-- Create chain_links table
CREATE TABLE public.chain_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.ment_chains(chain_id) ON DELETE CASCADE,
  passed_by UUID NOT NULL,
  passed_to TEXT NOT NULL,
  passed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  received_compliment TEXT NOT NULL,
  sent_compliment TEXT NOT NULL,
  was_forwarded BOOLEAN NOT NULL DEFAULT false
);

-- Add new columns to user_game_state table
ALTER TABLE public.user_game_state
ADD COLUMN pause_tokens INTEGER NOT NULL DEFAULT 0,
ADD COLUMN chains_started_today INTEGER NOT NULL DEFAULT 0,
ADD COLUMN your_turn_chains_count INTEGER NOT NULL DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.ment_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for ment_chains
CREATE POLICY "Users can view chains they started or are current holder"
ON public.ment_chains FOR SELECT
USING (auth.uid() = started_by OR current_holder = auth.uid()::text);

CREATE POLICY "Users can insert chains they start"
ON public.ment_chains FOR INSERT
WITH CHECK (auth.uid() = started_by);

CREATE POLICY "Users can update chains they started or are current holder"
ON public.ment_chains FOR UPDATE
USING (auth.uid() = started_by OR current_holder = auth.uid()::text);

-- RLS policies for chain_links
CREATE POLICY "Users can view links they passed or received"
ON public.chain_links FOR SELECT
USING (auth.uid() = passed_by OR passed_to = auth.uid()::text);

CREATE POLICY "Users can insert links they passed"
ON public.chain_links FOR INSERT
WITH CHECK (auth.uid() = passed_by);

CREATE POLICY "Users can update links they passed"
ON public.chain_links FOR UPDATE
USING (auth.uid() = passed_by);

-- Create index for faster chain lookups
CREATE INDEX idx_ment_chains_started_by ON public.ment_chains(started_by);
CREATE INDEX idx_ment_chains_current_holder ON public.ment_chains(current_holder);
CREATE INDEX idx_ment_chains_status ON public.ment_chains(status);
CREATE INDEX idx_chain_links_chain_id ON public.chain_links(chain_id);
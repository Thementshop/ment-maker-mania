-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_game_state table
CREATE TABLE public.user_game_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  jar_count INTEGER DEFAULT 25 NOT NULL,
  total_sent INTEGER DEFAULT 0 NOT NULL,
  current_level INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pending_ments table
CREATE TABLE public.pending_ments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  compliment_text TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_value TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sent_ments history table
CREATE TABLE public.sent_ments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  compliment_text TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create world_kindness_counter table (single row)
CREATE TABLE public.world_kindness_counter (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  count BIGINT DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial world counter row
INSERT INTO public.world_kindness_counter (id, count) VALUES (1, 1234567);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_ments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_ments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_kindness_counter ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User game state RLS policies
CREATE POLICY "Users can view own game state"
  ON public.user_game_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own game state"
  ON public.user_game_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game state"
  ON public.user_game_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Pending ments RLS policies
CREATE POLICY "Users can view own pending ments"
  ON public.pending_ments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pending ments"
  ON public.pending_ments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending ments"
  ON public.pending_ments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending ments"
  ON public.pending_ments FOR DELETE
  USING (auth.uid() = user_id);

-- Sent ments RLS policies
CREATE POLICY "Users can view own sent ments"
  ON public.sent_ments FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can insert own sent ments"
  ON public.sent_ments FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- World kindness counter RLS policies (readable by everyone)
CREATE POLICY "Anyone can view world counter"
  ON public.world_kindness_counter FOR SELECT
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_game_state_updated_at
  BEFORE UPDATE ON public.user_game_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_game_state (user_id, jar_count, total_sent, current_level)
  VALUES (NEW.id, 25, 0, 1);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile and game state on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create atomic increment function for world counter
CREATE OR REPLACE FUNCTION public.increment_world_counter()
RETURNS BIGINT AS $$
DECLARE
  new_count BIGINT;
BEGIN
  UPDATE public.world_kindness_counter
  SET count = count + 1, updated_at = NOW()
  WHERE id = 1
  RETURNING count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for world_kindness_counter
ALTER PUBLICATION supabase_realtime ADD TABLE world_kindness_counter;
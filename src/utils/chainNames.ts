import { supabase } from '@/integrations/supabase/client';

export const CHAIN_NAME_SUGGESTIONS = [
  "Positivity Wave",
  "Kindness Ripple",
  "Compliment Chain",
  "Love Loop",
  "Joy Circle",
  "Gratitude Ring",
  "Encouragement Express",
  "Smile Spreader",
  "Happiness Highway",
  "Compassion Cycle",
  "Warmth Wave",
  "Cheer Chain",
  "Blessing Bridge",
  "Appreciation Arc",
  "Support Circle",
  "Care Cascade",
  "Sunshine Spiral",
  "Bright Side Bounce",
  "Golden Thread",
  "Sweet Circle",
  "Uplift Link",
  "Heart Chain",
  "Gentle Ripple",
  "Spark Chain",
  "Light Loop",
  "Good Vibes Circuit",
  "Praise Path",
  "Affirm Loop",
  "Kindred Chain",
  "Spirit Spiral",
  "Unity Ring",
  "Inspire Wave",
  "Motivate Circle",
  "Celebrate Chain",
  "Honor Loop",
  "Respect Ripple",
  "Trust Thread",
  "Peace Path",
  "Hope Chain",
  "Dream Circle",
  "Thrive Link",
  "Flourish Loop",
  "Prosper Path",
  "Succeed Spiral",
  "Victory Chain",
  "Champion Circle",
  "Hero Loop",
  "Legend Link",
  "Epic Chain",
  "Magic Circle"
];

// Get 3 random available suggestions
export async function getAvailableChainNames(): Promise<string[]> {
  try {
    console.log('Fetching available chain names...');
    
    // Fetch currently used names with timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout fetching chain names')), 5000)
    );
    
    const fetchPromise = supabase
      .from('used_chain_names')
      .select('chain_name');
    
    const { data: usedNames, error } = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;
    
    if (error) {
      console.error('Error fetching used names:', error);
      // Return random suggestions even if fetch fails
      return CHAIN_NAME_SUGGESTIONS
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    }
    
    console.log('Used names fetched:', usedNames?.length || 0, 'names in use');
    const usedSet = new Set(usedNames?.map((n) => n.chain_name) || []);
    
    // Filter to only available names
    const available = CHAIN_NAME_SUGGESTIONS.filter(name => !usedSet.has(name));
    
    // If all names are taken, return some defaults anyway
    if (available.length === 0) {
      return ["My Kindness Chain", "Spreading Joy", "Share the Love"];
    }
    
    // Return 3 random suggestions
    return available
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
  } catch (err) {
    console.error('Error in getAvailableChainNames:', err);
    return CHAIN_NAME_SUGGESTIONS
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
  }
}

// Check if a specific name is available
export async function isChainNameAvailable(name: string): Promise<boolean> {
  try {
    console.log('Checking name availability for:', name.trim());
    
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout checking name availability')), 5000)
    );
    
    const fetchPromise = supabase
      .from('used_chain_names')
      .select('chain_name')
      .eq('chain_name', name.trim())
      .maybeSingle();
    
    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;
    
    if (error) {
      console.error('Error checking name availability:', error);
      // On error, optimistically assume available
      return true;
    }
    
    console.log('Name availability check result:', data === null ? 'available' : 'taken');
    return data === null;
  } catch (err) {
    console.error('Timeout or error checking name availability:', err);
    // On timeout, optimistically assume available to avoid blocking
    return true;
  }
}

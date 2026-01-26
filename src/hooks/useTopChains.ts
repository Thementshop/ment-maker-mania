import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TopChain {
  chain_id: string;
  links_count: number;
  created_at: string;
  status: string;
}

export const useTopChains = (limit: number = 5) => {
  const [topChains, setTopChains] = useState<TopChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTopChains = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get active chains from the last 24 hours, ordered by links_count
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const { data, error: fetchError } = await supabase
        .from('ment_chains')
        .select('chain_id, links_count, created_at, status')
        .eq('status', 'active')
        .gte('created_at', yesterday.toISOString())
        .order('links_count', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setTopChains(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch top chains'));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTopChains();

    // Subscribe to real-time changes on ment_chains table
    const channel = supabase
      .channel('top-chains-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ment_chains',
        },
        () => {
          // Refetch when any chain is created or updated
          fetchTopChains();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTopChains]);

  return { topChains, isLoading, error, refetch: fetchTopChains };
};

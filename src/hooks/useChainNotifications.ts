import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ChainPayload {
  chain_id: string;
  links_count: number;
  started_by: string;
  status: string;
}

export const useChainNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const previousCounts = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user) return;

    // First, fetch current chains the user started to initialize counts
    const initializeCounts = async () => {
      const { data } = await supabase
        .from('ment_chains')
        .select('chain_id, links_count')
        .eq('started_by', user.id)
        .eq('status', 'active');

      if (data) {
        data.forEach((chain) => {
          previousCounts.current.set(chain.chain_id, chain.links_count);
        });
      }
    };

    initializeCounts();

    // Subscribe to real-time updates on ment_chains
    const channel = supabase
      .channel('chain-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ment_chains',
        },
        (payload) => {
          const newData = payload.new as ChainPayload;
          
          // Only notify if user started this chain
          if (newData.started_by !== user.id) return;
          
          const previousCount = previousCounts.current.get(newData.chain_id) || 0;
          
          // Check if links_count increased (chain was passed)
          if (newData.links_count > previousCount && newData.status === 'active') {
            const chainShortId = newData.chain_id.slice(-4).toUpperCase();
            
            toast({
              title: "🔥 Chain Passed!",
              description: `Chain #${chainShortId} now has ${newData.links_count} links!`,
            });
            
            // Update the stored count
            previousCounts.current.set(newData.chain_id, newData.links_count);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);
};

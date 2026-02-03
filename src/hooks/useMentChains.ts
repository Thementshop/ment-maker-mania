import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getChainTier } from '@/utils/chainTiers';

export interface MentChain {
  chain_id: string;
  chain_name: string | null;
  started_by: string;
  current_holder: string;
  expires_at: string;
  status: 'active' | 'broken' | 'ended';
  links_count: number;
  share_count: number | null;
  tier: string | null;
  created_at: string;
  broken_at: string | null;
  is_queued: boolean | null;
  // Display names resolved from profiles
  started_by_display_name?: string;
  current_holder_display_name?: string;
  // Last received compliment for the current holder
  received_compliment?: string;
}

export interface ChainLink {
  link_id: string;
  chain_id: string;
  passed_by: string;
  passed_to: string;
  passed_at: string;
  received_compliment: string;
  sent_compliment: string;
  was_forwarded: boolean;
}

export interface UseMentChainsReturn {
  chains: MentChain[];
  yourTurnChains: MentChain[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  startChain: (recipientId: string, compliment: string, expiresAt: Date, chainName?: string) => Promise<MentChain | null>;
  passChain: (chainId: string, passedTo: string, receivedCompliment: string, sentCompliment: string) => Promise<boolean>;
  getChainLinks: (chainId: string) => Promise<ChainLink[]>;
  usePauseToken: (chainId: string) => Promise<boolean>;
}

export const useMentChains = (): UseMentChainsReturn => {
  const { user } = useAuth();
  const [chains, setChains] = useState<MentChain[]>([]);
  const [yourTurnChains, setYourTurnChains] = useState<MentChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Check and expire any chains that have timed out
  const checkAndExpireChains = useCallback(async () => {
    if (!user) return;
    
    const now = new Date().toISOString();
    
    try {
      // Find expired chains that the user is involved with
      const { data: expiredChains } = await supabase
        .from('ment_chains')
        .select('chain_id')
        .eq('status', 'active')
        .lt('expires_at', now)
        .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`);
      
      if (expiredChains && expiredChains.length > 0) {
        await supabase
          .from('ment_chains')
          .update({ 
            status: 'broken', 
            broken_at: now 
          })
          .in('chain_id', expiredChains.map(c => c.chain_id));
        
        console.log(`Auto-expired ${expiredChains.length} chains`);
      }
    } catch (err) {
      console.error('Error expiring chains:', err);
    }
  }, [user]);

  const fetchChains = useCallback(async () => {
    if (!user) {
      setChains([]);
      setYourTurnChains([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check and expire any chains that have timed out
      await checkAndExpireChains();

      // Fetch all chains the user is involved with
      const { data, error: fetchError } = await supabase
        .from('ment_chains')
        .select('*')
        .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const rawChains = (data || []) as MentChain[];

      // Collect unique user IDs for profile lookup
      const userIds = new Set<string>();
      rawChains.forEach(chain => {
        userIds.add(chain.started_by);
        // Only add current_holder if it looks like a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(chain.current_holder)) {
          userIds.add(chain.current_holder);
        }
      });

      // Batch fetch profiles for all unique user IDs
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', Array.from(userIds));

      const profileMap = new Map<string, string>();
      (profiles || []).forEach(p => {
        profileMap.set(p.id, p.display_name || 'Anonymous');
      });

      // Fetch received compliments for chains where user is current holder
      const chainIds = rawChains
        .filter(c => c.current_holder === user.id)
        .map(c => c.chain_id);
      
      let complimentMap = new Map<string, string>();
      if (chainIds.length > 0) {
        const { data: links } = await supabase
          .from('chain_links')
          .select('chain_id, sent_compliment, passed_at')
          .in('chain_id', chainIds)
          .order('passed_at', { ascending: false });
        
        // Get the most recent compliment for each chain
        (links || []).forEach(link => {
          if (!complimentMap.has(link.chain_id)) {
            complimentMap.set(link.chain_id, link.sent_compliment);
          }
        });
      }

      // Enhance chains with display names and compliments
      const typedChains: MentChain[] = rawChains.map(chain => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isCurrentHolderUuid = uuidRegex.test(chain.current_holder);
        
        return {
          ...chain,
          started_by_display_name: profileMap.get(chain.started_by) || 'Anonymous',
          current_holder_display_name: isCurrentHolderUuid 
            ? (profileMap.get(chain.current_holder) || 'Anonymous')
            : chain.current_holder, // Use raw value if it's email/phone/name
          received_compliment: complimentMap.get(chain.chain_id),
        };
      });

      setChains(typedChains);

      // Filter chains where it's the user's turn
      const yourTurn = typedChains.filter(
        chain => chain.current_holder === user.id && chain.status === 'active'
      );
      setYourTurnChains(yourTurn);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch chains'));
    } finally {
      setIsLoading(false);
    }
  }, [user, checkAndExpireChains]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    fetchChains();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('ment_chains_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ment_chains',
        },
        (payload) => {
          console.log('Chain updated:', payload);
          fetchChains(); // Refresh all chains on any change
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, fetchChains]);

  const startChain = useCallback(async (
    recipientId: string,
    compliment: string,
    expiresAt: Date,
    chainName?: string
  ): Promise<MentChain | null> => {
    if (!user) return null;

    try {
      // Insert the chain
      const { data: chainData, error: chainError } = await supabase
        .from('ment_chains')
        .insert({
          chain_name: chainName || null,
          started_by: user.id,
          current_holder: recipientId,
          expires_at: expiresAt.toISOString(),
          status: 'active',
          links_count: 1,
          share_count: 1,
          tier: 'small'
        })
        .select()
        .single();

      if (chainError) throw chainError;

      // Insert the first link
      const { error: linkError } = await supabase
        .from('chain_links')
        .insert({
          chain_id: chainData.chain_id,
          passed_by: user.id,
          passed_to: recipientId,
          received_compliment: '',
          sent_compliment: compliment,
          was_forwarded: false
        });

      if (linkError) throw linkError;

      await fetchChains();
      return chainData as MentChain;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start chain'));
      return null;
    }
  }, [user, fetchChains]);

  const passChain = useCallback(async (
    chainId: string,
    passedTo: string,
    receivedCompliment: string,
    sentCompliment: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // First get current chain data
      const { data: chainData, error: fetchError } = await supabase
        .from('ment_chains')
        .select('links_count, share_count')
        .eq('chain_id', chainId)
        .single();

      if (fetchError) throw fetchError;

      // Reset timer to NOW + 24 hours
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24);

      const newShareCount = (chainData?.share_count || 0) + 1;
      const newTier = getChainTier(newShareCount);

      // Update the chain with new holder, incremented count, and reset timer
      const { error: updateError } = await supabase
        .from('ment_chains')
        .update({
          current_holder: passedTo,
          links_count: (chainData?.links_count || 0) + 1,
          share_count: newShareCount,
          tier: newTier,
          expires_at: newExpiresAt.toISOString()
        })
        .eq('chain_id', chainId);

      if (updateError) throw updateError;

      // Insert the new link
      const { error: linkError } = await supabase
        .from('chain_links')
        .insert({
          chain_id: chainId,
          passed_by: user.id,
          passed_to: passedTo,
          received_compliment: receivedCompliment,
          sent_compliment: sentCompliment,
          was_forwarded: receivedCompliment === sentCompliment
        });

      if (linkError) throw linkError;

      await fetchChains();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to pass chain'));
      return false;
    }
  }, [user, fetchChains]);

  const getChainLinks = useCallback(async (chainId: string): Promise<ChainLink[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('chain_links')
        .select('*')
        .eq('chain_id', chainId)
        .order('passed_at', { ascending: true });

      if (fetchError) throw fetchError;

      return (data || []) as ChainLink[];
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch chain links'));
      return [];
    }
  }, []);

  const usePauseToken = useCallback(async (chainId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Get current user's pause tokens
      const { data: gameState, error: gsError } = await supabase
        .from('user_game_state')
        .select('pause_tokens, total_tokens_used')
        .eq('user_id', user.id)
        .single();

      if (gsError) throw gsError;
      
      if (!gameState || gameState.pause_tokens < 1) {
        return false;
      }

      // Reset timer to NOW + 24 hours
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Update chain timer
      const { error: chainError } = await supabase
        .from('ment_chains')
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq('chain_id', chainId);

      if (chainError) throw chainError;

      // Deduct pause token
      const { error: tokenError } = await supabase
        .from('user_game_state')
        .update({
          pause_tokens: gameState.pause_tokens - 1,
          total_tokens_used: (gameState.total_tokens_used || 0) + 1
        })
        .eq('user_id', user.id);

      if (tokenError) throw tokenError;

      await fetchChains();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to use pause token'));
      return false;
    }
  }, [user, fetchChains]);

  return {
    chains,
    yourTurnChains,
    isLoading,
    error,
    refetch: fetchChains,
    startChain,
    passChain,
    getChainLinks,
    usePauseToken
  };
};


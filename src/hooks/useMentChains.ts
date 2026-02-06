import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getChainTier } from '@/utils/chainTiers';

// Helper to add timeout to any promise or PromiseLike (like Supabase query builders)
const withTimeout = <T>(promiseLike: PromiseLike<T>, ms: number, name: string): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([Promise.resolve(promiseLike), timeout]);
};

// Retry wrapper for critical queries - handles Supabase client blocking issues
const fetchWithRetry = async <T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  name: string,
  timeoutMs: number = 5000
): Promise<{ data: T | null; error: any }> => {
  try {
    const result = await withTimeout(queryFn(), timeoutMs, name);
    return result;
  } catch (err) {
    console.warn(`[useMentChains] ${name} failed, retrying after session refresh...`);
    // Force session refresh before retry
    await supabase.auth.getSession();
    return await withTimeout(queryFn(), timeoutMs, `${name} (retry)`);
  }
};

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Check and expire any chains that have timed out (non-blocking)
  const checkAndExpireChains = useCallback(async () => {
    if (!user) return;
    
    const now = new Date().toISOString();
    
    try {
      // Find expired chains (with timeout)
      const expiredChainsQuery = supabase
        .from('ment_chains')
        .select('chain_id')
        .eq('status', 'active')
        .lt('expires_at', now)
        .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`);
      
      const { data: expiredChains } = await withTimeout(expiredChainsQuery, 3000, 'find expired chains');
      
      if (expiredChains && expiredChains.length > 0) {
        // Update expired chains (with timeout)
        const updateQuery = supabase
          .from('ment_chains')
          .update({ status: 'broken', broken_at: now })
          .in('chain_id', expiredChains.map(c => c.chain_id));
        
        await withTimeout(updateQuery, 3000, 'update expired chains');
        
        console.log(`Auto-expired ${expiredChains.length} chains`);
      }
    } catch (err) {
      // Log but don't throw - this is a background optimization
      console.warn('[useMentChains] Error expiring chains (non-fatal):', err);
    }
  }, [user]);

  const fetchChains = useCallback(async (silent = false) => {
    if (!user) {
      setChains([]);
      setYourTurnChains([]);
      setIsLoading(false);
      return;
    }

    try {
      // Only show loading spinner if not a silent refresh
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      console.log('[useMentChains] Fetching chains...');

      // CRITICAL: Ensure Supabase client has resolved auth state
      // This fixes the issue where queries hang during/after token refresh
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('[useMentChains] No active session, skipping fetch');
        setChains([]);
        setYourTurnChains([]);
        setIsLoading(false);
        return;
      }
      console.log('[useMentChains] Session confirmed, proceeding with fetch');

      // Check and expire any chains that have timed out (non-blocking)
      try {
        console.log('[useMentChains] Checking expired chains...');
        await withTimeout(checkAndExpireChains(), 5000, 'checkAndExpireChains');
        console.log('[useMentChains] Expired chains checked');
      } catch (expireError) {
        console.warn('[useMentChains] Expire check failed (non-fatal):', expireError);
        // Continue loading chains anyway
      }

      // Fetch all chains the user is involved with (with retry logic)
      console.log('[useMentChains] Fetching ment_chains...');
      const chainsQuery = () => supabase
        .from('ment_chains')
        .select('*')
        .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`)
        .order('created_at', { ascending: false });
      
      const chainsResult = await fetchWithRetry(chainsQuery, 'ment_chains query');
      const { data, error: fetchError } = chainsResult;
      console.log('[useMentChains] ment_chains fetched:', data?.length || 0, 'chains');

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

      // Batch fetch profiles for all unique user IDs (with retry)
      console.log('[useMentChains] Fetching profiles...');
      const profilesQuery = () => supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', Array.from(userIds));
      
      const profilesResult = await fetchWithRetry(profilesQuery, 'profiles query');
      const { data: profiles } = profilesResult;
      console.log('[useMentChains] Profiles fetched');

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
        console.log('[useMentChains] Fetching chain_links...');
        const linksQuery = () => supabase
          .from('chain_links')
          .select('chain_id, sent_compliment, passed_at')
          .in('chain_id', chainIds)
          .order('passed_at', { ascending: false });
        
        const linksResult = await fetchWithRetry(linksQuery, 'chain_links query');
        const { data: links } = linksResult;
        console.log('[useMentChains] Chain links fetched');
        
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
      console.log('[useMentChains] Done -', typedChains.length, 'chains loaded');
    } catch (err) {
      console.error('[useMentChains] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch chains'));
    } finally {
      setIsLoading(false);
    }
  }, [user, checkAndExpireChains]);

  // Real-time subscription
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setChains([]);
      setYourTurnChains([]);
      return;
    }

    // Safety timeout to prevent infinite spinner (10 seconds)
    const timeoutId = setTimeout(() => {
      console.warn('Chain fetch timed out, clearing loading state');
      setIsLoading(false);
    }, 10000);

    fetchChains().finally(() => {
      clearTimeout(timeoutId);
    });

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
          fetchChains(true); // Silent refresh - don't show loading spinner
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      clearTimeout(timeoutId);
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
    refetch: (silent?: boolean) => fetchChains(silent ?? false),
    startChain,
    passChain,
    getChainLinks,
    usePauseToken
  };
};


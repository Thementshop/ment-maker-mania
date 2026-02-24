import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getChainTier } from '@/utils/chainTiers';

// Direct REST API call - bypasses JS client blocking issues
const supabaseRest = async <T>(
  tableName: string,
  queryParams: string,
  accessToken: string
): Promise<{ data: T | null; error: any }> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${tableName}?${queryParams}`,
      {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: { message: errorText } };
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
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
  const { user, session } = useAuth();
  const [chains, setChains] = useState<MentChain[]>([]);
  const [yourTurnChains, setYourTurnChains] = useState<MentChain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchChains = useCallback(async (silent = false) => {
    if (!user || !session) {
      setChains([]);
      setYourTurnChains([]);
      setIsLoading(false);
      return;
    }

    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      console.log('[useMentChains] Fetching chains via REST API...');

      // Claim any unclaimed chains for this user (non-blocking — don't stall chain fetch)
      const claimPromise = Promise.race([
        supabase.rpc('claim_chains_for_user', { claiming_user_id: user.id }),
        new Promise((resolve) => setTimeout(() => { console.warn('[useMentChains] claim timed out after 3s'); resolve(null); }, 3000))
      ]).catch(err => console.warn('[useMentChains] claim failed (non-fatal):', err));
      // Fire and forget — don't await
      claimPromise;

      // Fetch all chains the user is involved with using direct REST API
      // Include chains where current_holder is user's UUID OR email (for unclaimed chains)
      const userEmail = user.email || '';
      const orFilter = userEmail
        ? `or=(started_by.eq.${user.id},current_holder.eq.${user.id},current_holder.eq.${userEmail})`
        : `or=(started_by.eq.${user.id},current_holder.eq.${user.id})`;
      
      const chainsResult = await supabaseRest<MentChain[]>(
        'ment_chains',
        `select=*&${orFilter}&order=created_at.desc`,
        session.access_token
      );

      if (chainsResult.error) {
        throw new Error(chainsResult.error.message || 'Failed to fetch chains');
      }

      const rawChains = chainsResult.data || [];
      console.log('[useMentChains] Fetched', rawChains.length, 'chains');

      // Collect unique user IDs for profile lookup
      const userIds = new Set<string>();
      rawChains.forEach(chain => {
        userIds.add(chain.started_by);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(chain.current_holder)) {
          userIds.add(chain.current_holder);
        }
      });

      // Batch fetch profiles using REST API
      let profileMap = new Map<string, string>();
      if (userIds.size > 0) {
        const idsArray = Array.from(userIds);
        const profilesResult = await supabaseRest<{ id: string; display_name: string | null }[]>(
          'profiles',
          `select=id,display_name&id=in.(${idsArray.join(',')})`,
          session.access_token
        );
        
        (profilesResult.data || []).forEach(p => {
          profileMap.set(p.id, p.display_name || 'Anonymous');
        });
      }

      // Fetch received compliments for chains where user is current holder (by UUID or email)
      const holderMatchedChains = rawChains.filter(
        c => c.current_holder === user.id || (userEmail && c.current_holder.toLowerCase() === userEmail.toLowerCase())
      );
      const chainIds = holderMatchedChains.map(c => c.chain_id);

      console.log('[useMentChains][Debug] Holder match before compliment lookup:', {
        userId: user.id,
        userEmail,
        holderMatchedChains: holderMatchedChains.map((c) => ({
          chain_id: c.chain_id,
          current_holder: c.current_holder,
          status: c.status,
        })),
      });
      
      let complimentMap = new Map<string, string>();
      if (chainIds.length > 0) {
        const linksResult = await supabaseRest<{ chain_id: string; sent_compliment: string; passed_at: string }[]>(
          'chain_links',
          `select=chain_id,sent_compliment,passed_at&chain_id=in.(${chainIds.join(',')})&order=passed_at.desc`,
          session.access_token
        );

        if (linksResult.error) {
          console.error('[useMentChains][Debug] chain_links query error:', linksResult.error);
        }

        const linkRows = linksResult.data || [];
        console.log('[useMentChains][Debug] chain_links query result:', linkRows);

        const foundChainIds = new Set(linkRows.map((link) => link.chain_id));
        const missingChainIds = chainIds.filter((id) => !foundChainIds.has(id));
        if (missingChainIds.length > 0) {
          console.warn('[useMentChains][Debug] Missing chain_links rows for chain IDs (RLS/claim timing check):', missingChainIds);
        }

        linkRows.forEach(link => {
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
            : chain.current_holder,
          received_compliment: complimentMap.get(chain.chain_id),
        };
      });

      setChains(typedChains);

      // Filter chains where it's the user's turn (by UUID or email)
      const yourTurn = typedChains.filter(
        chain => (chain.current_holder === user.id || 
          (userEmail && chain.current_holder.toLowerCase() === userEmail.toLowerCase())) && 
          chain.status === 'active'
      );
      setYourTurnChains(yourTurn);
      console.log('[useMentChains][Debug] Resolved your-turn compliments:', yourTurn.map((chain) => ({
        chain_id: chain.chain_id,
        current_holder: chain.current_holder,
        received_compliment: chain.received_compliment,
      })));
      console.log('[useMentChains] Done -', typedChains.length, 'chains loaded,', yourTurn.length, 'your turn');
    } catch (err) {
      console.error('[useMentChains] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch chains'));
    } finally {
      setIsLoading(false);
    }
  }, [user, session]);

  // Initial fetch and real-time subscription
  useEffect(() => {
    if (!user || !session) {
      setIsLoading(false);
      setChains([]);
      setYourTurnChains([]);
      return;
    }

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
          fetchChains(true); // Silent refresh
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, session, fetchChains]);

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
    if (!session) return [];
    
    try {
      const result = await supabaseRest<ChainLink[]>(
        'chain_links',
        `select=*&chain_id=eq.${chainId}&order=passed_at.asc`,
        session.access_token
      );

      if (result.error) throw new Error(result.error.message);
      return result.data || [];
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch chain links'));
      return [];
    }
  }, [session]);

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

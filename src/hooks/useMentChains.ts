import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MentChain {
  chain_id: string;
  started_by: string;
  current_holder: string;
  expires_at: string;
  status: 'active' | 'broken' | 'ended';
  links_count: number;
  created_at: string;
  broken_at: string | null;
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
  startChain: (recipientId: string, compliment: string, expiresAt: Date) => Promise<MentChain | null>;
  passChain: (chainId: string, passedTo: string, receivedCompliment: string, sentCompliment: string) => Promise<boolean>;
  getChainLinks: (chainId: string) => Promise<ChainLink[]>;
}

export const useMentChains = (): UseMentChainsReturn => {
  const { user } = useAuth();
  const [chains, setChains] = useState<MentChain[]>([]);
  const [yourTurnChains, setYourTurnChains] = useState<MentChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check and expire any chains that have timed out
  const checkAndExpireChains = useCallback(async () => {
    if (!user) return;
    
    const now = new Date().toISOString();
    
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

      const typedChains = (data || []) as MentChain[];
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

  const startChain = useCallback(async (
    recipientId: string,
    compliment: string,
    expiresAt: Date
  ): Promise<MentChain | null> => {
    if (!user) return null;

    try {
      // Insert the chain
      const { data: chainData, error: chainError } = await supabase
        .from('ment_chains')
        .insert({
          started_by: user.id,
          current_holder: recipientId,
          expires_at: expiresAt.toISOString(),
          status: 'active',
          links_count: 1
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
          was_forwarded: true
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
      // First get current links_count
      const { data: chainData, error: fetchError } = await supabase
        .from('ment_chains')
        .select('links_count')
        .eq('chain_id', chainId)
        .single();

      if (fetchError) throw fetchError;

      // Reset timer to NOW + 24 hours
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24);

      // Update the chain with new holder, incremented count, and reset timer
      const { error: updateError } = await supabase
        .from('ment_chains')
        .update({
          current_holder: passedTo,
          links_count: (chainData?.links_count || 0) + 1,
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
          was_forwarded: true
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

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  return {
    chains,
    yourTurnChains,
    isLoading,
    error,
    refetch: fetchChains,
    startChain,
    passChain,
    getChainLinks
  };
};

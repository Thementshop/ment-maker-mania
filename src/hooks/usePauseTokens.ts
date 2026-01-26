import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PauseTokenState {
  pauseTokens: number;
  lastFreeTokenDate: Date | null;
  totalTokensUsed: number;
  daysUntilFreeToken: number;
  canClaimFreeToken: boolean;
  isLoading: boolean;
}

interface UsePauseTokensReturn extends PauseTokenState {
  claimFreeToken: () => Promise<boolean>;
  usePauseToken: (chainId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const DAYS_BETWEEN_FREE_TOKENS = 7;

export const usePauseTokens = (): UsePauseTokensReturn => {
  const { user } = useAuth();
  const [state, setState] = useState<PauseTokenState>({
    pauseTokens: 0,
    lastFreeTokenDate: null,
    totalTokensUsed: 0,
    daysUntilFreeToken: DAYS_BETWEEN_FREE_TOKENS,
    canClaimFreeToken: false,
    isLoading: true,
  });

  const calculateDaysUntilFree = (lastDate: Date | null): { days: number; canClaim: boolean } => {
    if (!lastDate) {
      return { days: 0, canClaim: true };
    }
    
    const now = new Date();
    const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, DAYS_BETWEEN_FREE_TOKENS - daysSinceLast);
    
    return {
      days: daysRemaining,
      canClaim: daysSinceLast >= DAYS_BETWEEN_FREE_TOKENS,
    };
  };

  const fetchTokenState = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_game_state')
        .select('pause_tokens, last_free_token_date, total_tokens_used')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const lastDate = data?.last_free_token_date ? new Date(data.last_free_token_date) : null;
      const { days, canClaim } = calculateDaysUntilFree(lastDate);

      setState({
        pauseTokens: data?.pause_tokens ?? 1,
        lastFreeTokenDate: lastDate,
        totalTokensUsed: data?.total_tokens_used ?? 0,
        daysUntilFreeToken: days,
        canClaimFreeToken: canClaim,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error fetching pause token state:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  const claimFreeToken = async (): Promise<boolean> => {
    if (!user || !state.canClaimFreeToken) return false;

    try {
      const { error } = await supabase
        .from('user_game_state')
        .update({
          pause_tokens: state.pauseTokens + 1,
          last_free_token_date: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        pauseTokens: prev.pauseTokens + 1,
        lastFreeTokenDate: new Date(),
        daysUntilFreeToken: DAYS_BETWEEN_FREE_TOKENS,
        canClaimFreeToken: false,
      }));

      return true;
    } catch (err) {
      console.error('Error claiming free token:', err);
      return false;
    }
  };

  const usePauseToken = async (chainId: string): Promise<boolean> => {
    if (!user || state.pauseTokens <= 0) return false;

    try {
      // Reset chain timer to NOW + 24 hours
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24);

      const { error: chainError } = await supabase
        .from('ment_chains')
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq('chain_id', chainId);

      if (chainError) throw chainError;

      // Deduct token from user
      const { error: tokenError } = await supabase
        .from('user_game_state')
        .update({
          pause_tokens: state.pauseTokens - 1,
          total_tokens_used: state.totalTokensUsed + 1,
        })
        .eq('user_id', user.id);

      if (tokenError) throw tokenError;

      setState(prev => ({
        ...prev,
        pauseTokens: prev.pauseTokens - 1,
        totalTokensUsed: prev.totalTokensUsed + 1,
      }));

      return true;
    } catch (err) {
      console.error('Error using pause token:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchTokenState();
  }, [fetchTokenState]);

  return {
    ...state,
    claimFreeToken,
    usePauseToken,
    refetch: fetchTokenState,
  };
};

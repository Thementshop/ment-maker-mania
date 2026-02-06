import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BrokenChainData {
  chain_id: string;
  chain_name: string | null;
  share_count: number;
  broken_by: string | null;
  broken_by_display_name?: string;
  links: Array<{
    passed_by: string;
    passed_by_display_name?: string;
    sent_compliment: string;
    passed_at: string;
  }>;
}

export const useBrokenChainNotification = () => {
  const { user } = useAuth();
  const [brokenChain, setBrokenChain] = useState<BrokenChainData | null>(null);
  const [viewedBrokenChains, setViewedBrokenChains] = useState<Set<string>>(() => {
    // Load from localStorage to prevent re-showing on refresh
    const stored = localStorage.getItem('viewed_broken_chains');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Mark a chain as viewed
  const markAsViewed = useCallback((chainId: string) => {
    setViewedBrokenChains(prev => {
      const next = new Set(prev);
      next.add(chainId);
      localStorage.setItem('viewed_broken_chains', JSON.stringify([...next]));
      return next;
    });
    setBrokenChain(null);
  }, []);

  // Check for broken chains the user started
  const checkForBrokenChains = useCallback(async () => {
    if (!user) return;

    // Get chains the user started that are now broken and haven't been viewed
    const { data: brokenChains, error } = await supabase
      .from('ment_chains')
      .select('chain_id, chain_name, share_count, broken_by, broken_at')
      .eq('started_by', user.id)
      .eq('status', 'broken')
      .not('broken_at', 'is', null)
      .order('broken_at', { ascending: false })
      .limit(1);

    if (error || !brokenChains || brokenChains.length === 0) return;

    const chain = brokenChains[0];
    
    // Skip if already viewed
    if (viewedBrokenChains.has(chain.chain_id)) return;

    // Fetch the chain links (compliments)
    const { data: links } = await supabase
      .from('chain_links')
      .select('passed_by, sent_compliment, passed_at')
      .eq('chain_id', chain.chain_id)
      .order('passed_at', { ascending: true });

    // Resolve display names for link authors
    const resolvedLinks = await Promise.all(
      (links || []).map(async (link) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', link.passed_by)
          .single();
        
        return {
          ...link,
          passed_by_display_name: profile?.display_name || null,
        };
      })
    );

    // Resolve broken_by display name
    let brokenByDisplayName: string | undefined;
    if (chain.broken_by) {
      // Check if it's a UUID (registered user) or email/phone
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(chain.broken_by)) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', chain.broken_by)
          .single();
        brokenByDisplayName = profile?.display_name || undefined;
      } else {
        // It's an email/phone - use as-is
        brokenByDisplayName = chain.broken_by;
      }
    }

    setBrokenChain({
      chain_id: chain.chain_id,
      chain_name: chain.chain_name,
      share_count: chain.share_count || 1,
      broken_by: chain.broken_by,
      broken_by_display_name: brokenByDisplayName,
      links: resolvedLinks,
    });
  }, [user, viewedBrokenChains]);

  // Check if current user broke someone else's chain (for gentle toast)
  const checkIfUserBrokeChain = useCallback(async () => {
    if (!user) return;

    // Check for recently broken chains where this user was the holder
    const { data: brokenChains } = await supabase
      .from('ment_chains')
      .select('chain_id, chain_name, broken_at')
      .eq('broken_by', user.id)
      .eq('status', 'broken')
      .neq('started_by', user.id) // Don't show for chains they started
      .order('broken_at', { ascending: false })
      .limit(1);

    if (!brokenChains || brokenChains.length === 0) return;

    const chain = brokenChains[0];
    const brokenAt = new Date(chain.broken_at!);
    const now = new Date();
    const hoursSinceBroken = (now.getTime() - brokenAt.getTime()) / (1000 * 60 * 60);

    // Only show toast if broken within last hour and not already viewed
    const toastKey = `broke_toast_${chain.chain_id}`;
    if (hoursSinceBroken < 1 && !localStorage.getItem(toastKey)) {
      localStorage.setItem(toastKey, 'true');
      toast.info(
        `The "${chain.chain_name}" chain ended 💔 Don't worry, it happens to everyone!`,
        { duration: 5000 }
      );
    }
  }, [user]);

  // Run checks on mount and when user changes
  useEffect(() => {
    checkForBrokenChains();
    checkIfUserBrokeChain();
  }, [checkForBrokenChains, checkIfUserBrokeChain]);

  // Subscribe to realtime updates for broken chains
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('broken-chains')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ment_chains',
          filter: `started_by=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.status === 'broken' && payload.old.status !== 'broken') {
            // Chain just broke - refresh to show modal
            checkForBrokenChains();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, checkForBrokenChains]);

  return {
    brokenChain,
    markAsViewed,
    refreshBrokenChains: checkForBrokenChains,
  };
};
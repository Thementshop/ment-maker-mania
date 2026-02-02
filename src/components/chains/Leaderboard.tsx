import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Link, Share2, Loader2, User, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getChainTier, tierConfig } from '@/utils/chainTiers';

type Period = 'week' | 'month' | 'allTime';

interface ChainWithProfile {
  chain_id: string;
  chain_name: string | null;
  share_count: number | null;
  tier: string | null;
  created_at: string;
  started_by: string;
  status: string;
}

interface LeaderboardEntryProps {
  chain: ChainWithProfile;
  rank: number;
  isYourChain: boolean;
  onShareAchievement: (chain: ChainWithProfile) => void;
}

const getRankEmoji = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `#${rank}`;
  }
};

const getChainAge = (createdAt: string): string => {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

const getCardClassName = (rank: number, isYourChain: boolean): string => {
  if (isYourChain) return 'border-primary bg-primary/10';
  
  switch (rank) {
    case 1: return 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20';
    case 2: return 'border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50';
    case 3: return 'border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20';
    default: return 'border-border hover:border-primary/50 hover:bg-primary/5';
  }
};

function LeaderboardEntry({ chain, rank, isYourChain, onShareAchievement }: LeaderboardEntryProps) {
  const tier = chain.tier || getChainTier(chain.share_count || 0);
  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.small;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={`p-4 rounded-xl border-2 transition-all ${getCardClassName(rank, isYourChain)}`}
    >
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
          {rank <= 3 ? (
            <span className="text-3xl">{getRankEmoji(rank)}</span>
          ) : (
            <span className="text-lg font-bold text-muted-foreground">{getRankEmoji(rank)}</span>
          )}
        </div>
        
        {/* Chain Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-foreground truncate">
              {chain.chain_name || 'Unnamed Chain'}
            </h3>
            {isYourChain && (
              <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                YOUR CHAIN!
              </span>
            )}
            {tier === 'legendary' && (
              <span className="text-sm">✨</span>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Link className="h-3.5 w-3.5" />
              <strong className="text-foreground">{chain.share_count || 0}</strong> shares
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {getChainAge(chain.created_at)}
            </span>
          </div>
        </div>
        
        {/* Tier Badge */}
        <div 
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
          style={{ 
            background: `linear-gradient(135deg, ${config.color}40, ${config.color}20)`,
            border: `2px solid ${config.color}`
          }}
        >
          {config.emoji}
        </div>
      </div>
      
      {/* Share Achievement Button (only for your chains) */}
      {isYourChain && (
        <Button
          onClick={() => onShareAchievement(chain)}
          variant="default"
          size="sm"
          className="w-full mt-3"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share Achievement
        </Button>
      )}
    </motion.div>
  );
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('week');
  const [topChains, setTopChains] = useState<ChainWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopChains(period);
  }, [period]);

  async function fetchTopChains(selectedPeriod: Period) {
    setLoading(true);
    
    try {
      const startDate = {
        week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        allTime: new Date(0)
      }[selectedPeriod];
      
      let query = supabase
        .from('ment_chains')
        .select('chain_id, chain_name, share_count, tier, created_at, started_by, status')
        .order('share_count', { ascending: false })
        .limit(10);
      
      if (selectedPeriod !== 'allTime') {
        query = query.gte('created_at', startDate.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setTopChains(data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  function handleShareAchievement(chain: ChainWithProfile) {
    const rank = topChains.findIndex(c => c.chain_id === chain.chain_id) + 1;
    
    const shareText = `🎉 My chain "${chain.chain_name || 'Kindness Chain'}" hit #${rank} on The Ment Shop leaderboard with ${chain.share_count} shares!

Join me in spreading kindness! 💚🍬

Download: https://thementshop.com`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Ment Shop Achievement',
        text: shareText,
        url: 'https://thementshop.com'
      }).catch(err => console.log('Share cancelled', err));
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Achievement text copied to clipboard!');
    }
  }

  const periods = [
    { id: 'week' as Period, label: 'This Week' },
    { id: 'month' as Period, label: 'This Month' },
    { id: 'allTime' as Period, label: 'All Time' }
  ];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Trophy className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Top Chains</h2>
      </div>
      
      {/* Period Filters */}
      <div className="flex justify-center gap-2 mb-6">
        {periods.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-4 py-2 rounded-full font-semibold transition-all ${
              period === p.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}
      
      {/* Leaderboard List */}
      {!loading && topChains.length > 0 && (
        <div className="space-y-3">
          {topChains.map((chain, index) => (
            <LeaderboardEntry
              key={chain.chain_id}
              chain={chain}
              rank={index + 1}
              isYourChain={chain.started_by === user?.id}
              onShareAchievement={handleShareAchievement}
            />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {!loading && topChains.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg text-muted-foreground mb-2">
            No chains in this time period yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Be the first to start one! 🔗
          </p>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;

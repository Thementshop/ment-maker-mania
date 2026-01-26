import { motion } from 'framer-motion';
import { Trophy, Link, Loader2 } from 'lucide-react';
import { useTopChains } from '@/hooks/useTopChains';
import { Skeleton } from '@/components/ui/skeleton';

const getRankDisplay = (rank: number) => {
  switch (rank) {
    case 1:
      return <span className="text-lg">🥇</span>;
    case 2:
      return <span className="text-lg">🥈</span>;
    case 3:
      return <span className="text-lg">🥉</span>;
    default:
      return <span className="text-sm font-bold text-muted-foreground w-6 text-center">{rank}</span>;
  }
};

const formatChainId = (chainId: string) => {
  // Take last 4 characters of UUID for display
  return `#${chainId.slice(-4).toUpperCase()}`;
};

const TopChainsLeaderboard = () => {
  const { topChains, isLoading, error } = useTopChains(5);

  if (isLoading) {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Top Chains Today</span>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        Unable to load leaderboard
      </div>
    );
  }

  if (topChains.length === 0) {
    return (
      <div className="w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Top Chains Today</span>
        </div>
        <div className="bg-secondary/50 rounded-lg px-4 py-3">
          <Link className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No chains yet today</p>
          <p className="text-xs text-muted-foreground mt-1">Be the first to start one!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Top Chains Today</span>
      </div>
      
      <div className="space-y-1.5">
        {topChains.map((chain, index) => (
          <motion.div
            key={chain.chain_id}
            className="flex items-center justify-between bg-secondary/50 backdrop-blur-sm rounded-lg px-3 py-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex items-center gap-2">
              {getRankDisplay(index + 1)}
              <span className="text-sm font-mono font-medium text-foreground">
                {formatChainId(chain.chain_id)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-semibold text-primary">
                {chain.links_count}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TopChainsLeaderboard;

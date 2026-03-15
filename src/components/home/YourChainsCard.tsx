import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useMentChains } from '@/hooks/useMentChains';
import { useCountdown } from '@/hooks/useCountdown';

interface ChainTimerProps {
  expiresAt: string;
}

const ChainTimer = ({ expiresAt }: ChainTimerProps) => {
  const { hours, minutes } = useCountdown(expiresAt);
  const isUrgent = hours === 0 && minutes < 60;
  
  return (
    <span className={`text-xs font-medium ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
      ⏰ {hours}h {minutes}m left
    </span>
  );
};

interface YourChainsCardProps {
  onStartChain: () => void;
}

const YourChainsCard = ({ onStartChain }: YourChainsCardProps) => {
  const { user } = useAuth();
  const { chains, isLoading } = useMentChains();

  const { myTurnChains, activeChains } = useMemo(() => {
    const userId = user?.id || '';
    const userEmail = user?.email || '';
    
    const active = chains.filter(c => c.status === 'active');
    const myTurn = active.filter(c => 
      c.current_holder === userId || 
      (userEmail && c.current_holder.toLowerCase() === userEmail.toLowerCase())
    );
    
    return { myTurnChains: myTurn, activeChains: active };
  }, [chains, user]);

  return (
    <motion.div
      className="bg-card rounded-2xl p-4 border border-border shadow-sm flex flex-col"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, type: 'spring' }}
    >
      <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
        🔗 Your Chains
      </h3>

      <div className="flex-1 mb-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : myTurnChains.length > 0 ? (
          <>
            <div className="text-sm font-semibold mb-2 text-foreground">⏰ Your Turn:</div>
            {myTurnChains.slice(0, 2).map(chain => (
              <div key={chain.chain_id} className="mb-2 p-2 bg-accent/50 rounded-lg">
                <div className="font-medium text-sm text-foreground truncate">
                  {chain.chain_name || `Chain #${chain.chain_id.slice(0, 6)}`}
                </div>
                <ChainTimer expiresAt={chain.expires_at} />
              </div>
            ))}
            {myTurnChains.length > 2 && (
              <p className="text-xs text-muted-foreground">+{myTurnChains.length - 2} more waiting</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active chains right now!
          </p>
        )}

        <div className="text-xs text-muted-foreground mt-2">
          {activeChains.length} active chain{activeChains.length !== 1 ? 's' : ''}
        </div>
      </div>

      <button
        onClick={onStartChain}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
      >
        + Start Chain
      </button>
    </motion.div>
  );
};

export default YourChainsCard;

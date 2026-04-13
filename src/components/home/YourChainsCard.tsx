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
      <div className="w-full flex justify-center mb-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4">
        <img 
          src="/images/ment-chain.png" 
          alt="Ment Chain" 
          className="h-40 object-contain drop-shadow-md"
        />
      </div>

      <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
        🔗 Your Chains
      </h3>

      <div className="flex-1 mb-3 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : activeChains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No chains yet. Start one below!
          </p>
        ) : (
          <>
            {myTurnChains.length > 0 ? (
              <p className="text-sm font-semibold text-destructive">
                🔴 {myTurnChains.length} chain{myTurnChains.length !== 1 ? 's' : ''} waiting on you
              </p>
            ) : (
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                ✅ All caught up! No chains need your attention
              </p>
            )}
            {activeChains.length - myTurnChains.length > 0 && (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                🟢 {activeChains.length - myTurnChains.length} active chain{activeChains.length - myTurnChains.length !== 1 ? 's' : ''} going strong
              </p>
            )}
          </>
        )}
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

import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import mentChainBg from '@/assets/ment-chain-bg.png';
import TopChainsLeaderboard from '@/components/chains/TopChainsLeaderboard';

const MentChains = () => {
  return (
    <div className="relative w-full h-full min-h-[280px] rounded-xl overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${mentChainBg})` }}
      />
      
      {/* Gradient Overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/80 to-background/50" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full p-4 text-center">
        {/* Title */}
        <motion.div 
          className="flex items-center gap-2 mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Flame className="h-4 w-4 text-orange-500" />
          <h2 className="font-display text-lg font-bold text-foreground">Ment Chains</h2>
          <Flame className="h-4 w-4 text-orange-500" />
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="text-xs font-semibold text-orange-500 flex items-center gap-1 mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          🔥 Don't Break The Chain! 🔥
        </motion.p>

        {/* Leaderboard */}
        <motion.div
          className="flex-1 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <TopChainsLeaderboard />
        </motion.div>
      </div>
    </div>
  );
};

export default MentChains;

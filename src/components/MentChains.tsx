import { motion } from 'framer-motion';
import { Flame, Link } from 'lucide-react';
import mentChainBg from '@/assets/ment-chain-bg.png';

const MentChains = () => {
  return (
    <div className="relative w-full h-full min-h-[280px] rounded-xl overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${mentChainBg})` }}
      />
      
      {/* Gradient Overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/70 to-background/40" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 text-center">
        {/* Title */}
        <motion.div 
          className="flex items-center gap-2 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Flame className="h-5 w-5 text-orange-500" />
          <h2 className="font-display text-xl font-bold text-foreground">Ment Chains</h2>
          <Flame className="h-5 w-5 text-orange-500" />
        </motion.div>

        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="mb-4"
        >
          <Link className="h-12 w-12 text-primary" />
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="text-sm font-semibold text-orange-500 flex items-center gap-1 mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          🔥 Don't Break The Chain! 🔥
        </motion.p>

        {/* Coming Soon Badge */}
        <motion.div
          className="bg-secondary/80 backdrop-blur-sm rounded-full px-4 py-1.5 mb-3"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <span className="text-sm font-semibold text-foreground">Coming Soon</span>
        </motion.div>

        {/* Description */}
        <motion.p
          className="text-xs text-muted-foreground max-w-[200px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Start chain reactions of kindness with your friends!
        </motion.p>
      </div>
    </div>
  );
};

export default MentChains;

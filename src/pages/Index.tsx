import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getCurrentLevel } from '@/store/gameStore';
import Header from '@/components/Header';
import GlassJar from '@/components/GlassJar';
import LevelBadge from '@/components/LevelBadge';
import StatsCounters from '@/components/StatsCounters';
import MintButton from '@/components/MintButton';
import SendMentModal from '@/components/SendMentModal';
import LevelUpModal from '@/components/LevelUpModal';
import InspirationalQuote from '@/components/InspirationalQuote';

const Index = () => {
  const { jarCount, totalSent, pendingMents, worldKindnessCount, sendMent } = useGameStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpBonus, setLevelUpBonus] = useState(0);
  
  const handleSendMent = () => {
    const prevLevel = getCurrentLevel(totalSent);
    sendMent();
    const newLevel = getCurrentLevel(totalSent + 1);
    
    // Check for level up
    if (newLevel.level > prevLevel.level) {
      setLevelUpBonus(newLevel.reward);
      setTimeout(() => {
        setShowLevelUp(true);
      }, 500);
    }
  };
  
  const pendingCount = pendingMents.filter(m => m.status === 'pending').length;
  
  return (
    <div className="min-h-screen bg-gradient-mint">
      <Header worldCount={worldKindnessCount} />
      
      <main className="container flex flex-col items-center gap-6 sm:gap-8 py-6 sm:py-8 pb-24 px-4">
        {/* Level Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <LevelBadge totalSent={totalSent} />
        </motion.div>
        
        {/* Glass Jar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <GlassJar mintCount={jarCount} />
        </motion.div>
        
        {/* Stats Counters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatsCounters 
            jarCount={jarCount}
            totalSent={totalSent}
            pendingCount={pendingCount}
          />
        </motion.div>
        
        {/* Send Ment Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="my-4"
        >
          <MintButton onClick={() => setIsModalOpen(true)} />
        </motion.div>
        
        {/* Inspirational Quote */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-xs"
        >
          <InspirationalQuote />
        </motion.div>
      </main>
      
      {/* Send Ment Modal */}
      <SendMentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSend={handleSendMent}
      />
      
      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={showLevelUp}
        onClose={() => setShowLevelUp(false)}
        totalSent={totalSent}
        bonusMints={levelUpBonus}
      />
    </div>
  );
};

export default Index;

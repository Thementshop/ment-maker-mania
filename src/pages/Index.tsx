import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getCurrentLevel } from '@/store/gameStore';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GlassJar from '@/components/GlassJar';
import LevelBadge from '@/components/LevelBadge';
import MintButton from '@/components/MintButton';
import SendMentModal from '@/components/SendMentModal';
import LevelUpModal from '@/components/LevelUpModal';
import InspirationalQuote from '@/components/InspirationalQuote';
import tmsBanner from '@/assets/TMS_banner.png';

const Index = () => {
  const {
    jarCount,
    totalSent,
    pendingMents,
    worldKindnessCount,
    sendMent
  } = useGameStore();
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
  return <div className="min-h-screen bg-gradient-mint flex flex-col">
      <Header worldCount={worldKindnessCount} />
      
      {/* Banner Image */}
      <div className="w-full">
        <img 
          src={tmsBanner} 
          alt="Welcome to The Ment Shop - The Candy Store of Compliments" 
          className="w-full object-cover object-center"
        />
      </div>
      
      <main className="container items-center gap-6 sm:gap-8 py-6 sm:py-8 pb-24 px-4 flex flex-row">
        {/* Jar Section with Level Badge above */}
        <div className="flex flex-col items-center gap-4 mx-[75px]">
          {/* Level Badge */}
          <motion.div initial={{
          opacity: 0,
          y: -20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.1
        }}>
            <LevelBadge totalSent={totalSent} />
          </motion.div>
          
          {/* Glass Jar */}
          <motion.div initial={{
          opacity: 0,
          scale: 0.9
        }} animate={{
          opacity: 1,
          scale: 1
        }} transition={{
          delay: 0.2,
          type: 'spring'
        }}>
            <GlassJar mintCount={jarCount} pendingCount={pendingCount} totalSent={totalSent} />
          </motion.div>
        </div>
        
        {/* Send Ment Button */}
        <motion.div initial={{
        opacity: 0,
        scale: 0.8
      }} animate={{
        opacity: 1,
        scale: 1
      }} transition={{
        delay: 0.4,
        type: 'spring'
      }} className="my-4 ml-auto flex flex-col items-center">
          <MintButton onClick={() => setIsModalOpen(true)} />
          <motion.div className="mt-2 rounded-xl bg-card px-4 py-2 shadow-sm text-center" whileHover={{
          scale: 1.05
        }}>
            <motion.span key={totalSent} className="font-display text-2xl font-bold text-foreground" initial={{
            scale: 1.2,
            color: 'hsl(var(--mint))'
          }} animate={{
            scale: 1,
            color: 'hsl(var(--foreground))'
          }}>
              {totalSent}
            </motion.span>
            <span className="text-xs text-muted-foreground ml-1">Sent</span>
          </motion.div>
        </motion.div>
        
        {/* Inspirational Quote */}
        <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.5
      }} className="max-w-xs">
          <InspirationalQuote />
        </motion.div>
      </main>
      
      {/* Send Ment Modal */}
      <SendMentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSend={handleSendMent} />
      
      {/* Level Up Modal */}
      <LevelUpModal isOpen={showLevelUp} onClose={() => setShowLevelUp(false)} totalSent={totalSent} bonusMints={levelUpBonus} />
      
      {/* Footer */}
      <Footer />
    </div>;
};
export default Index;
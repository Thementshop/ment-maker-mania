import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useAuth } from '@/contexts/AuthContext';
import { useChainNotifications } from '@/hooks/useChainNotifications';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SendMentModal from '@/components/SendMentModal';
import LevelUpModal from '@/components/LevelUpModal';
import SendMentSection from '@/components/home/SendMentSection';
import KindnessJarSection from '@/components/home/KindnessJarSection';
import MentChainsSection from '@/components/home/MentChainsSection';
import MintCircleGraphic from '@/components/chains/MintCircleGraphic';
import tmsBanner from '@/assets/TMS_banner.png';

const Index = () => {
  // Enable real-time notifications for chain updates
  useChainNotifications();
  const { profile } = useAuth();
  const {
    jarCount,
    totalSent,
    pendingMents,
    worldKindnessCount,
    isLoading,
    sendMent
  } = useGameStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpBonus, setLevelUpBonus] = useState(0);

  const handleSendMent = async (mentData: { category: string; complimentText: string; recipientType: string }) => {
    const result = await sendMent(mentData);
    
    if (result.leveledUp) {
      setLevelUpBonus(result.bonusMints);
      setTimeout(() => {
        setShowLevelUp(true);
      }, 500);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-mint flex flex-col">
      <Header worldCount={worldKindnessCount} />
      
      {/* Banner Image */}
      <div className="w-full">
        <img 
          src={tmsBanner} 
          alt="Welcome to The Ment Shop - The Candy Store of Compliments" 
          className="w-full max-h-[400px] object-contain object-center"
        />
      </div>
      
      <main className="container flex-1 py-6 sm:py-8 pb-24 px-4">
        {/* TEST: MintCircleGraphic Component - Remove after testing */}
        <div className="mb-8 p-6 bg-card rounded-xl border border-border">
          <h2 className="text-xl font-bold text-center mb-6">🧪 MintCircleGraphic Test (Remove Later)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Small (1-24)</p>
              <MintCircleGraphic shareCount={12} tier="small" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Medium (25-49)</p>
              <MintCircleGraphic shareCount={34} tier="medium" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Large (50-99)</p>
              <MintCircleGraphic shareCount={67} tier="large" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Legendary (100+)</p>
              <MintCircleGraphic shareCount={156} tier="legendary" />
            </div>
          </div>
        </div>
        {/* END TEST */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Left: Kindness Jar */}
          <KindnessJarSection 
            jarCount={jarCount} 
            totalSent={totalSent} 
          />
          
          {/* Center: Send a Ment */}
          <SendMentSection 
            onOpenModal={() => setIsModalOpen(true)} 
            totalSent={totalSent} 
          />
          
          {/* Right: Ment Chains */}
          <MentChainsSection />
        </div>
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
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;

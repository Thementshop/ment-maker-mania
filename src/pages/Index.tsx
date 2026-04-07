import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useAuth } from '@/contexts/AuthContext';
import { useChainNotifications } from '@/hooks/useChainNotifications';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SendAMentModal from '@/components/SendAMentModal';
import LevelUpModal from '@/components/LevelUpModal';
import OnboardingModal from '@/components/OnboardingModal';
import SendMentSection from '@/components/home/SendMentSection';
import KindnessJarSection from '@/components/home/KindnessJarSection';
import YourChainsCard from '@/components/home/YourChainsCard';
import ChainDashboard from '@/components/chains/ChainDashboard';
import StartChainModal from '@/components/chains/StartChainModal';
import tmsBanner from '@/assets/TMS_banner.png';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const Index = () => {
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
  
  const [isSendAMentOpen, setIsSendAMentOpen] = useState(false);
  const [isStartChainOpen, setIsStartChainOpen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpBonus, setLevelUpBonus] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-mint flex flex-col">
      <Header worldCount={worldKindnessCount} />
      
      <div className="w-full">
        <img 
          src={tmsBanner} 
          alt="Welcome to The Ment Shop - The Candy Store of Compliments" 
          className="w-full max-h-[400px] object-contain object-center"
        />
      </div>
      
      <main className="container flex-1 py-6 sm:py-8 pb-24 px-4">
        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            {/* Left: Kindness Jar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <KindnessJarSection jarCount={jarCount} totalSent={totalSent} />
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Collect mints by sending kindness! 🍬</p></TooltipContent>
            </Tooltip>
            
            {/* Center: Send A Ment (graphic button) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SendMentSection 
                    onOpenModal={() => setIsSendAMentOpen(true)} 
                    totalSent={totalSent} 
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Send a compliment to earn mints! ✨</p></TooltipContent>
            </Tooltip>
            
            {/* Right: Your Chains summary */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <YourChainsCard onStartChain={() => setIsStartChainOpen(true)} />
                </div>
              </TooltipTrigger>
              <TooltipContent><p>View your active chains and start new ones! 🔗</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <section id="chains" className="mt-8">
          <ChainDashboard />
        </section>
      </main>
      
      {/* Send Ment Modal (chain-based) */}
      <SendMentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSend={handleSendMent} />

      {/* Send A Ment Modal (single, no chain) */}
      <SendAMentModal isOpen={isSendAMentOpen} onClose={() => setIsSendAMentOpen(false)} />

      {/* Start Chain Modal from card */}
      <StartChainModal isOpen={isStartChainOpen} onClose={() => setIsStartChainOpen(false)} onSuccess={() => {}} />
      
      <LevelUpModal isOpen={showLevelUp} onClose={() => setShowLevelUp(false)} totalSent={totalSent} bonusMints={levelUpBonus} />
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <Footer />
    </div>
  );
};

export default Index;

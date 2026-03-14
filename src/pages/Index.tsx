import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useAuth } from '@/contexts/AuthContext';
import { useChainNotifications } from '@/hooks/useChainNotifications';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SendMentModal from '@/components/SendMentModal';
import SendAMentModal from '@/components/SendAMentModal';
import LevelUpModal from '@/components/LevelUpModal';
import OnboardingModal from '@/components/OnboardingModal';
import SendMentSection from '@/components/home/SendMentSection';
import KindnessJarSection from '@/components/home/KindnessJarSection';
import ChainDashboard from '@/components/chains/ChainDashboard';
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSendAMentOpen, setIsSendAMentOpen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpBonus, setLevelUpBonus] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding for first-time users
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

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
        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            {/* Left: Kindness Jar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <KindnessJarSection 
                    jarCount={jarCount} 
                    totalSent={totalSent} 
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Collect mints by sending kindness! 🍬</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Center: Send a Ment (chain-based) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SendMentSection 
                    onOpenModal={() => setIsModalOpen(true)} 
                    totalSent={totalSent} 
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Send compliments to earn mints! ✨</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Right: Send A Ment (single, no chain) */}
            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex flex-col">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                💌 Send A Ment
              </h3>
              <p className="text-sm text-muted-foreground mb-3 flex-1">
                Send a single compliment — no timer, no pressure!
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => setIsSendAMentOpen(true)}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                  >
                    💚 Send A Ment
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send a single compliment (no chain) 💌</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>

        {/* Chain Dashboard Section */}
        <section id="chains" className="mt-8">
          <ChainDashboard />
        </section>
      </main>
      
      {/* Send Ment Modal (chain-based) */}
      <SendMentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSend={handleSendMent} 
      />

      {/* Send A Ment Modal (single, no chain) */}
      <SendAMentModal
        isOpen={isSendAMentOpen}
        onClose={() => setIsSendAMentOpen(false)}
      />
      
      {/* Level Up Modal */}
      <LevelUpModal 
        isOpen={showLevelUp} 
        onClose={() => setShowLevelUp(false)} 
        totalSent={totalSent} 
        bonusMints={levelUpBonus} 
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;

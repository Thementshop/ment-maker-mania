import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SendMentModal from '@/components/SendMentModal';
import LevelUpModal from '@/components/LevelUpModal';
import SendMentSection from '@/components/home/SendMentSection';
import KindnessJarSection from '@/components/home/KindnessJarSection';
import MentChainsSection from '@/components/home/MentChainsSection';
import CarouselDots from '@/components/CarouselDots';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import tmsBanner from '@/assets/TMS_banner.png';
import unwrappedMint from '@/assets/unwrapped-mint.png';

const Index = () => {
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
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

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
        {/* Desktop: 3-column grid */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
          <SendMentSection 
            onOpenModal={() => setIsModalOpen(true)} 
            totalSent={totalSent} 
          />
          <KindnessJarSection 
            jarCount={jarCount} 
            totalSent={totalSent} 
          />
          <MentChainsSection />
        </div>

        {/* Mobile: Swipeable carousel */}
        <div className="lg:hidden">
          <Carousel setApi={setCarouselApi} opts={{ loop: false }}>
            <CarouselContent>
              <CarouselItem>
                <SendMentSection 
                  onOpenModal={() => setIsModalOpen(true)} 
                  totalSent={totalSent} 
                />
              </CarouselItem>
              <CarouselItem>
                <KindnessJarSection 
                  jarCount={jarCount} 
                  totalSent={totalSent} 
                />
              </CarouselItem>
              <CarouselItem>
                <MentChainsSection />
              </CarouselItem>
            </CarouselContent>
          </Carousel>
          <CarouselDots api={carouselApi} count={3} />
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

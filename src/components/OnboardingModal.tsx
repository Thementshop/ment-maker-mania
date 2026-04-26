import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Heart, Send, Link2, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import unwrappedMint from '@/assets/unwrapped-mint.png';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const screens = [
  {
    emoji: '💚',
    title: 'Welcome to Ment Shop!',
    description: 'Spread kindness through compliment chains and single ments. Every act of kindness earns you mints!',
    icon: <Heart className="h-12 w-12 text-primary" />,
    color: 'from-primary/20 to-primary/10',
  },
  {
    emoji: '🔗',
    title: 'How Chains Work',
    description: 'Start a chain by picking a compliment and sending it to up to 3 people. Each person has 24 hours to pass it forward!',
    icon: <Link2 className="h-12 w-12 text-orange-500" />,
    color: 'from-orange-500/20 to-orange-500/10',
    steps: [
      '1. Pick a compliment',
      '2. Send to up to 3 people',
      '3. They pass it forward within 24 hours',
    ],
  },
  {
    emoji: '💌',
    title: 'Send A Ment',
    description: 'Want something simpler? Send a single compliment — no timer, no chain, no pressure. Just kindness!',
    icon: <Send className="h-12 w-12 text-pink-500" />,
    color: 'from-pink-500/20 to-pink-500/10',
  },
  {
    emoji: '💚',
    title: 'Earn Mints & Level Up!',
    description: 'Collect mints for every compliment sent. Level up your jar from "Ment Maker" all the way to "Ment Legend"!',
    icon: <img src={unwrappedMint} alt="Mint" className="h-12 w-12 object-contain" />,
    color: 'from-green-500/20 to-green-500/10',
    steps: [
      '+1 mint for sending a ment',
      '+5 mints for starting a chain',
      'Bonus mints at each level up!',
    ],
  },
];

const OnboardingModal = ({ isOpen, onClose }: OnboardingModalProps) => {
  const [currentScreen, setCurrentScreen] = useState(0);

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setCurrentScreen(0);
    onClose();
  };

  const screen = screens[currentScreen];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleFinish}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-50 bg-card rounded-3xl shadow-2xl overflow-hidden border border-border/50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Skip button */}
            <button
              onClick={handleFinish}
              className="absolute top-4 right-4 z-10 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScreen}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="text-center space-y-6 w-full"
                >
                  <motion.div
                    className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${screen.color}`}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {screen.icon}
                  </motion.div>

                  <div>
                    <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                      {screen.emoji} {screen.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {screen.description}
                    </p>
                  </div>

                  {screen.steps && (
                    <div className="space-y-2 text-left bg-muted/50 rounded-xl p-4">
                      {screen.steps.map((stepText, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                          <Sparkles className="h-4 w-4 text-primary shrink-0" />
                          {stepText}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress dots + navigation */}
            <div className="p-6 border-t border-border/30">
              {/* Dots */}
              <div className="flex justify-center gap-2 mb-4">
                {screens.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === currentScreen ? 'bg-primary w-6' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {currentScreen > 0 && (
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <Button onClick={handleNext} className="flex-1">
                  {currentScreen === screens.length - 1 ? (
                    'Get Started! 💚'
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OnboardingModal;

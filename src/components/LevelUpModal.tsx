import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentLevel } from '@/store/gameStore';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import brandMint from '@/assets/brand-mint.png';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalSent: number;
  bonusMints: number;
}

const LevelUpModal = ({ isOpen, onClose, totalSent, bonusMints }: LevelUpModalProps) => {
  const currentLevel = getCurrentLevel(totalSent);
  
  useEffect(() => {
    if (isOpen) {
      // Trigger celebration confetti
      const duration = 3 * 1000;
      const end = Date.now() + duration;
      
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#58fc59', '#FFD740', '#FF6B9D'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#58fc59', '#4FC3F7', '#B39DDB'],
        });
        
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      
      frame();
    }
  }, [isOpen]);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-mint to-mint-dark p-8 text-center text-primary-foreground shadow-2xl"
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sparkles */}
            <motion.span 
              className="absolute -top-4 left-1/4 text-3xl"
              animate={{ 
                opacity: [1, 0.5, 1],
                scale: [1, 1.2, 1],
                rotate: [0, 15, -15, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ✨
            </motion.span>
            <motion.span 
              className="absolute -top-2 right-1/4 text-2xl"
              animate={{ 
                opacity: [1, 0.5, 1],
                scale: [1, 1.2, 1],
                rotate: [0, -15, 15, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            >
              ✨
            </motion.span>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <span className="text-6xl">🎉</span>
            </motion.div>
            
            <motion.h2
              className="mt-4 font-display text-3xl font-bold"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Level Up!
            </motion.h2>
            
            <motion.p
              className="mt-2 text-lg opacity-90"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              You're now a
            </motion.p>
            
            <motion.p
              className="mt-1 font-display text-2xl font-bold"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Level {currentLevel.level}: {currentLevel.name}
            </motion.p>
            
            <motion.div
              className="mt-6 rounded-2xl bg-primary-foreground/20 p-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-sm opacity-80">Bonus Reward</p>
              <p className="font-display text-3xl font-bold flex items-center justify-center gap-2">
                +{bonusMints} mints!
                <img src={brandMint} alt="" className="h-8 w-8 object-contain" />
              </p>
            </motion.div>
            
            <motion.button
              className="mt-6 rounded-full bg-primary-foreground px-8 py-3 font-display font-bold text-mint transition-transform hover:scale-105"
              onClick={onClose}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Sweet! 💚
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LevelUpModal;

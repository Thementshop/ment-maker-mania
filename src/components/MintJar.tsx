import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentTier, getNextTier, getTierProgress, getMintsToNextTier } from '@/utils/jarTiers';
import { getCurrentLevel, getLevelProgress, getMentsToNextLevel } from '@/store/gameStore';
import { Progress } from '@/components/ui/progress';
import { Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface MintJarProps {
  jarCount: number;
  totalSent: number;
}

const getJarWithMintsImage = (count: number, emptyImage: string): string => {
  if (count === 0) return emptyImage;
  if (count === 1) return '/images/jar-1-mint.png';
  if (count === 2) return '/images/jar-2-mints.png';
  if (count === 3) return '/images/jar-3-mints.png';
  if (count === 4) return '/images/jar-4-mints.png';
  if (count < 25) return '/images/jar-5-mints.png';
  if (count < 50) return '/images/jar-25-mints.png';
  if (count < 100) return '/images/jar-50-mints.png';
  return '/images/jar-100-mints.png';
};

const MintJar = ({ jarCount, totalSent }: MintJarProps) => {
  const currentTier = getCurrentTier(jarCount);
  const nextTier = getNextTier(jarCount);
  const tierProgress = getTierProgress(jarCount);
  const mintsToNext = getMintsToNextTier(jarCount);
  const currentLevel = getCurrentLevel(jarCount);
  const levelProgress = getLevelProgress(jarCount);
  const mentsToNextLevel = getMentsToNextLevel(jarCount);

  const [showTierUp, setShowTierUp] = useState(false);
  const previousTierRef = useRef(currentTier.tier);

  useEffect(() => {
    const newTier = getCurrentTier(jarCount).tier;
    if (newTier > previousTierRef.current) {
      setShowTierUp(true);
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#58fc59', '#FFD740', '#FF6B9D'] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#58fc59', '#4FC3F7', '#B39DDB'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      setTimeout(() => setShowTierUp(false), 4000);
    }
    previousTierRef.current = newTier;
  }, [jarCount]);

  const jarImage = getJarWithMintsImage(jarCount, currentTier.image);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Kindness Jar
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
          Level {currentLevel.level}
        </span>
      </h2>

      {/* Jar Display */}
      <div className="relative w-full h-64 flex items-center justify-center">
        <div className="relative w-56 h-64 rounded-2xl">
          <div className="absolute inset-0 rounded-2xl bg-white" aria-hidden="true" />
          <motion.img
            key={jarImage}
            src={jarImage}
            alt={`Jar with ${jarCount} mints`}
            className="absolute inset-0 z-10 w-full h-full object-contain"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          />

          <motion.div
            className="absolute top-2 right-2 z-20 bg-gradient-to-br from-amber-400 to-amber-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.3 }}
          >
            {currentTier.name}
          </motion.div>
        </div>
      </div>

      {/* Mint count */}
      <div className="text-center">
        <motion.span
          key={jarCount}
          className="font-display text-5xl font-bold text-primary"
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {jarCount}
        </motion.span>
        <p className="text-sm text-muted-foreground mt-1">Total Mints Collected</p>
      </div>

      {/* Level Info */}
      <div className="w-full max-w-xs">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm font-semibold text-foreground">
            Level {currentLevel.level}: {currentLevel.name}
          </span>
        </div>
        {currentLevel.level < 25 && (
          <div className="space-y-1">
            <Progress value={levelProgress} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {mentsToNextLevel} ments to Level {currentLevel.level + 1}
            </p>
          </div>
        )}
        {currentLevel.level >= 25 && (
          <p className="text-xs text-primary text-center font-semibold">
            🎉 Max Level Reached!
          </p>
        )}
      </div>

      {/* Tier Progress */}
      {nextTier && (
        <div className="w-full max-w-xs mt-1">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{currentTier.name} Jar</span>
            <span>{nextTier.name} Jar</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(tierProgress, 100)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {mintsToNext} mints until <strong>{nextTier.name}</strong> jar
          </p>
        </div>
      )}
      {!nextTier && (
        <p className="text-xs text-primary text-center font-semibold">
          🏆 Max Tier Reached!
        </p>
      )}

      {/* Tier-Up Celebration Modal */}
      <AnimatePresence>
        {showTierUp && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTierUp(false)}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 p-8 text-center text-white shadow-2xl"
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-6xl">🎉</span>
              <h2 className="mt-4 font-display text-3xl font-bold">JAR UPGRADE!</h2>
              <p className="mt-2 text-lg opacity-90">
                Your jar evolved to <strong>{currentTier.name}</strong>!
              </p>
              <img
                src={currentTier.image}
                className="w-32 h-auto mx-auto mt-4"
                alt={`${currentTier.name} Jar`}
              />
              <motion.button
                className="mt-6 rounded-full bg-white px-8 py-3 font-display font-bold text-amber-600 transition-transform hover:scale-105"
                onClick={() => setShowTierUp(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Amazing! ✨
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MintJar;

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
      // Confetti
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

  // Calculate how many mints to show (cap at 60 for performance)
  const mintsToShow = Math.min(jarCount, 60);

  // Jar image analysis (jar-tier-1.png is 1344x896):
  // The glass body is NOT centered - it's slightly left of center
  // When rendered at 224x240 with object-contain:
  // Image scales to fit: 224px wide → height = 224*(896/1344) = 149px
  // Vertical offset: (240-149)/2 = 45px from top
  // Jar glass interior (relative to the 224x149 rendered image):
  //   Left wall: ~35% of 224 = 78px
  //   Right wall: ~58% of 224 = 130px  → interior width ~52px
  //   Bottom: ~82% of 149 + 45 offset = 167 from top → 240-167 = 73px from bottom
  //   Top of glass: ~42% of 149 + 45 = 108 from top → 240-108 = 132px from bottom
  // So interior box: left=78, bottom=73, width=52, height=59
  
  const JAR_INTERIOR = {
    left: 82,      // shifted 4px right to center on glass body
    bottom: 73,    // px from bottom of 240px container
    width: 54,     // slightly wider spread across jar base
    height: 55,    // interior height (glass body only)
  };
  const MINT_SIZE = 8;

  const getMintPosition = (index: number) => {
    // Seeded pseudo-random
    const s1 = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    const s2 = Math.sin(index * 269.5 + 183.3) * 43758.5453;
    const s3 = Math.sin(index * 419.2 + 371.9) * 43758.5453;
    const r1 = s1 - Math.floor(s1);
    const r2 = s2 - Math.floor(s2);
    const r3 = s3 - Math.floor(s3);

    // Layer-based stacking from bottom
    const layer = Math.floor(index / 5);
    const layerY = layer * (MINT_SIZE * 0.7) + r2 * 2;
    const x = r1 * (JAR_INTERIOR.width - MINT_SIZE);

    return {
      left: Math.max(0, Math.min(x, JAR_INTERIOR.width - MINT_SIZE)),
      bottom: Math.max(0, Math.min(layerY, JAR_INTERIOR.height - MINT_SIZE)),
      rotation: (r3 - 0.5) * 25,
      scale: 0.85 + r1 * 0.2,
      delay: index * 0.01,
    };
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Title */}
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Kindness Jar
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
          Level {currentLevel.level}
        </span>
      </h2>

      {/* Jar Display */}
      <div className="relative w-full h-64 flex items-center justify-center">
        {/* Single container for both jar and mints */}
        <div className="relative" style={{ width: '224px', height: '240px' }}>
          {/* Jar image - reference point */}
          <motion.img
            key={currentTier.tier}
            src={currentTier.image}
            alt={`${currentTier.name} Jar`}
            className="absolute inset-0 w-full h-full object-contain z-20 pointer-events-none"
            style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          />

          {/* Mints container - precisely mapped to jar glass interior */}
          <div
            className="absolute overflow-hidden z-30"
            style={{
              bottom: `${JAR_INTERIOR.bottom}px`,
              left: `${JAR_INTERIOR.left}px`,
              width: `${JAR_INTERIOR.width}px`,
              height: `${JAR_INTERIOR.height}px`,
            }}
          >
            {/* Mints stack from bottom up naturally */}
            <div className="relative w-full h-full">
              {Array.from({ length: mintsToShow }).map((_, i) => {
                const { left, bottom, rotation, scale, delay } = getMintPosition(i);
                return (
                  <motion.img
                    key={i}
                    src="/images/mint-candy.png"
                    alt="mint"
                    className="absolute"
                    style={{
                      width: `${MINT_SIZE}px`,
                      height: `${MINT_SIZE}px`,
                      left: `${left}px`,
                      bottom: `${bottom}px`,
                      transform: `rotate(${rotation}deg) scale(${scale})`,
                      opacity: 0.95,
                    }}
                    initial={{ y: -30, opacity: 0, scale: 0.3 }}
                    animate={{ y: 0, opacity: 0.95, scale }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 14,
                      delay,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Tier badge */}
        <motion.div
          className="absolute top-2 right-2 z-30 bg-gradient-to-br from-amber-400 to-amber-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.3 }}
        >
          {currentTier.name}
        </motion.div>
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

      {/* Tier Progress (next jar) */}
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
                className="w-32 h-auto mx-auto mt-4 drop-shadow-2xl"
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

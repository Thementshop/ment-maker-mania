import { motion } from 'framer-motion';
import unwrappedMint from '@/assets/unwrapped-mint.png';
import jarLevel1 from '@/assets/jar-level-1.png';
import { getCurrentLevel } from '@/store/gameStore';

interface GlassJarProps {
  mintCount: number;
  pendingCount: number;
  totalSent?: number;
}

const GlassJar = ({
  mintCount,
  pendingCount,
  totalSent = 0
}: GlassJarProps) => {
  const currentLevel = getCurrentLevel(totalSent);
  const isLevel1 = currentLevel.level === 1;

  // Determine jar size based on mint count
  const getJarHeight = () => {
    if (mintCount <= 50) return 'h-48';
    if (mintCount <= 150) return 'h-64';
    if (mintCount <= 500) return 'h-80';
    if (mintCount <= 1000) return 'h-96';
    return 'h-[28rem]';
  };

  // Calculate how many mints to show (max ~30 for performance)
  const displayCount = Math.min(mintCount, 30);
  const mintSize = mintCount > 100 ? 'w-8 h-8' : mintCount > 50 ? 'w-10 h-10' : 'w-12 h-12';

  // Generate random positions for mints within the jar
  const generateMintPositions = () => {
    const positions = [];
    for (let i = 0; i < displayCount; i++) {
      positions.push({
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 70,
        rotation: Math.random() * 360,
        delay: i * 0.02
      });
    }
    return positions;
  };
  
  const mintPositions = generateMintPositions();

  return (
    <div className="relative flex-col flex items-center justify-start">
      {/* Sparkles for high mint count */}
      {mintCount > 500 && (
        <>
          <motion.span
            className="absolute -top-4 left-1/4 text-2xl sparkle"
            animate={{ opacity: [1, 0.5, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
          >
            ✨
          </motion.span>
          <motion.span
            className="absolute -top-2 right-1/4 text-xl sparkle"
            animate={{ opacity: [1, 0.5, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          >
            ✨
          </motion.span>
          <motion.span
            className="absolute top-1/4 -right-4 text-lg sparkle"
            animate={{ opacity: [1, 0.5, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
          >
            ✨
          </motion.span>
        </>
      )}

      {/* Level 1 Jar - Use uploaded image */}
      {isLevel1 ? (
        <div className="relative">
          <motion.img
            src={jarLevel1}
            alt="Glass Jar"
            className="h-48 sm:h-56 w-auto object-contain"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          />
          {/* Mints overlay for level 1 jar */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-24 h-24 mt-4">
              {mintPositions.slice(0, Math.min(displayCount, 15)).map((pos, i) => (
                <motion.img
                  key={i}
                  src={unwrappedMint}
                  alt="Mint"
                  className="absolute w-6 h-6 object-contain"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: `translate(-50%, -50%) rotate(${pos.rotation}deg)`
                  }}
                  initial={{ y: -100, opacity: 0, scale: 0.5 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                    delay: pos.delay
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Default Jar Container for other levels */
        <div className={`glass-jar relative ${getJarHeight()} w-44 sm:w-52 rounded-3xl overflow-hidden`}>
          {/* Jar Lid */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-gradient-to-b from-gray-300 to-gray-400 rounded-full shadow-md" />
          
          {/* Jar Neck */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-8 bg-gradient-to-b from-white/60 to-transparent rounded-t-2xl" />
          
          {/* Mints inside jar */}
          <div className="absolute inset-4 overflow-hidden">
            {mintPositions.map((pos, i) => (
              <motion.img
                key={i}
                src={unwrappedMint}
                alt="Mint"
                className={`absolute ${mintSize} object-contain`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) rotate(${pos.rotation}deg)`
                }}
                initial={{ y: -200, opacity: 0, scale: 0.5 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                  delay: pos.delay
                }}
              />
            ))}
          </div>
          
          {/* Glass shine effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-4 left-4 w-8 h-16 bg-white/20 rounded-full blur-sm" />
        </div>
      )}

      {/* Mint count label */}
      <motion.div
        key={mintCount}
        className="mt-4 rounded-full bg-mint/10 px-4 py-1"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
      >
        <span className="font-display text-lg font-bold text-mint">
          {mintCount.toLocaleString()} Ments
        </span>
      </motion.div>

      {/* Pending count */}
      <motion.div
        className="mt-2 rounded-xl bg-card px-4 py-2 shadow-sm text-center"
        whileHover={{ scale: 1.05 }}
      >
        <motion.span className="font-display text-2xl font-bold text-foreground">
          {pendingCount}
        </motion.span>
        <span className="text-xs text-muted-foreground ml-1">Pending (8h)</span>
      </motion.div>
    </div>
  );
};

export default GlassJar;
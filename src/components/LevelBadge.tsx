import { motion } from 'framer-motion';
import { getCurrentLevel, getLevelProgress, getMentsToNextLevel } from '@/store/gameStore';
interface LevelBadgeProps {
  totalSent: number;
}
const LevelBadge = ({
  totalSent
}: LevelBadgeProps) => {
  const currentLevel = getCurrentLevel(totalSent);
  const progress = getLevelProgress(totalSent);
  const mentsToNext = getMentsToNextLevel(totalSent);
  return <div className="flex flex-col items-center gap-3">
      <motion.div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 shadow-sm" whileHover={{
      scale: 1.02
    }}>
        
        <span className="font-display text-sm font-semibold text-foreground">
          Level {currentLevel.level}: {currentLevel.name}
        </span>
      </motion.div>
      
      {currentLevel.level < 15 && <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{mentsToNext} to Level {currentLevel.level + 1}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-mint to-mint-light" initial={{
          width: 0
        }} animate={{
          width: `${Math.min(progress, 100)}%`
        }} transition={{
          duration: 0.5,
          ease: 'easeOut'
        }} />
          </div>
        </div>}
    </div>;
};
export default LevelBadge;
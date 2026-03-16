import { motion } from 'framer-motion';
import { getCurrentLevel, getLevelProgress, getMentsToNextLevel } from '@/store/gameStore';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface SimplifiedJarProps {
  jarCount: number;
  totalSent: number;
}

const SimplifiedJar = ({ jarCount, totalSent }: SimplifiedJarProps) => {
  const currentLevel = getCurrentLevel(jarCount);
  const progress = getLevelProgress(jarCount);
  const mentsToNext = getMentsToNextLevel(jarCount);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Title */}
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Kindness Jar
      </h2>

      {/* Total Ments Count */}
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
        <p className="text-sm text-muted-foreground mt-1">Total Ments Collected</p>
      </div>

      {/* Level Info */}
      <div className="w-full max-w-xs">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm font-semibold text-foreground">
            Level {currentLevel.level}: {currentLevel.name}
          </span>
        </div>

        {/* Progress Bar */}
        {currentLevel.level < 25 && (
          <div className="space-y-1">
            <Progress value={progress} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {mentsToNext} ments to Level {currentLevel.level + 1}
            </p>
          </div>
        )}

        {currentLevel.level === 25 && (
          <p className="text-xs text-primary text-center font-semibold">
            🎉 Max Level Reached!
          </p>
        )}
      </div>

      {/* Customize Button (Disabled) */}
      <Button variant="outline" disabled className="mt-2 opacity-60">
        Customize Jar (Coming Soon)
      </Button>
    </div>
  );
};

export default SimplifiedJar;

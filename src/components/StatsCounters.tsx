import { motion } from 'framer-motion';
interface StatsCountersProps {
  jarCount: number;
  totalSent: number;
  pendingCount: number;
}
const StatsCounters = ({
  jarCount,
  totalSent,
  pendingCount
}: StatsCountersProps) => {
  return <div className="flex justify-center gap-4 sm:gap-8 text-center">
      
      
      <motion.div className="flex flex-col items-center rounded-xl bg-card p-3 shadow-sm" whileHover={{
      scale: 1.05
    }}>
        
        <motion.span key={totalSent} className="font-display text-2xl font-bold text-foreground" initial={{
        scale: 1.2,
        color: 'hsl(var(--mint))'
      }} animate={{
        scale: 1,
        color: 'hsl(var(--foreground))'
      }}>
          {totalSent}
        </motion.span>
        <span className="text-xs text-muted-foreground">Sent</span>
      </motion.div>
      
      <motion.div className="flex flex-col items-center rounded-xl bg-card p-3 shadow-sm" whileHover={{
      scale: 1.05
    }}>
        
        <motion.span className="font-display text-2xl font-bold text-foreground">
          {pendingCount}
        </motion.span>
        <span className="text-xs text-muted-foreground">Pending (8h)</span>
      </motion.div>
    </div>;
};
export default StatsCounters;
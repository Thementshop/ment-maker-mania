import { motion } from 'framer-motion';
import MentChains from '@/components/MentChains';

const MentChainsSection = () => {
  return (
    <motion.div
      className="bg-card rounded-2xl p-6 shadow-lg border border-border h-full flex flex-col items-center justify-center min-h-[280px]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, type: 'spring' }}
    >
      <MentChains />
    </motion.div>
  );
};

export default MentChainsSection;

import { motion } from 'framer-motion';
import MintButton from '@/components/MintButton';

interface SendMentSectionProps {
  onOpenModal: () => void;
  totalSent: number;
}

const SendMentSection = ({ onOpenModal, totalSent }: SendMentSectionProps) => {
  return (
    <motion.div
      className="bg-card rounded-2xl p-6 shadow-lg border border-border h-full flex flex-col items-center justify-center min-h-[280px]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, type: 'spring' }}
    >
      <MintButton onClick={onOpenModal} />
      
      <motion.div
        className="mt-4 rounded-xl bg-secondary/50 px-4 py-2 shadow-sm text-center"
        whileHover={{ scale: 1.05 }}
      >
        <motion.span
          key={totalSent}
          className="font-display text-2xl font-bold text-foreground"
          initial={{ scale: 1.2, color: 'hsl(var(--primary))' }}
          animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
        >
          {totalSent}
        </motion.span>
        <span className="text-xs text-muted-foreground ml-1">Sent</span>
      </motion.div>
    </motion.div>
  );
};

export default SendMentSection;

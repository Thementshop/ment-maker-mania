import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import MintButton from '@/components/MintButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SendMentSectionProps {
  onOpenModal: () => void;
  totalSent: number;
}

const SendMentSection = ({ onOpenModal, totalSent }: SendMentSectionProps) => {
  const { user } = useAuth();
  const [lifetimeSent, setLifetimeSent] = useState<number>(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('sent_ments')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id);
      if (!cancelled) setLifetimeSent(count ?? 0);
    })();
    return () => { cancelled = true; };
    // Re-fetch whenever a new send happens (totalSent increments locally).
  }, [user?.id, totalSent]);

  return (
    <motion.div
      className="bg-card rounded-2xl p-6 shadow-lg border border-border h-full flex flex-col items-center justify-center min-h-[280px]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, type: 'spring' }}
    >
      <MintButton onClick={onOpenModal} />

      <motion.div
        className="mt-4 rounded-full px-4 py-1.5 shadow-sm text-center inline-flex items-center gap-1.5"
        style={{
          background: 'linear-gradient(135deg, rgba(88,252,89,0.15), rgba(88,252,89,0.25))',
          border: '1px solid rgba(88,252,89,0.4)',
        }}
        whileHover={{ scale: 1.05 }}
      >
        <motion.span
          key={lifetimeSent}
          className="font-display text-xl font-bold"
          initial={{ scale: 1.3, color: 'hsl(var(--primary))' }}
          animate={{ scale: 1, color: '#166534' }}
        >
          {lifetimeSent}
        </motion.span>
        <span className="text-xs font-semibold" style={{ color: '#166534' }}>
          Ments sent 💚
        </span>
      </motion.div>
    </motion.div>
  );
};

export default SendMentSection;

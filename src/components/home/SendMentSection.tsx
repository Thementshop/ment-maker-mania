import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import MintButton from '@/components/MintButton';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore } from '@/store/gameStore';

interface SendMentSectionProps {
  onOpenModal: () => void;
  userId: string | null;
  authResolved: boolean;
}

const SendMentSection = ({ onOpenModal, userId, authResolved }: SendMentSectionProps) => {
  const refreshTick = useGameStore((s) => s.refreshTick);
  const [lifetimeSent, setLifetimeSent] = useState<number>(0);

  const fetchCount = useCallback(async () => {
    if (!authResolved) return;

    if (!userId) {
      setLifetimeSent(0);
      return;
    }

    // Canonical source: COUNT(sent_ments) + COUNT(chain_links) for this user
    const [{ count: singles }, { count: chainSends }] = await Promise.all([
      supabase
        .from('sent_ments')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId),
      supabase
        .from('chain_links')
        .select('link_id', { count: 'exact', head: true })
        .eq('passed_by', userId),
    ]);
    setLifetimeSent((singles ?? 0) + (chainSends ?? 0));
  }, [userId, authResolved]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount, refreshTick]);

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

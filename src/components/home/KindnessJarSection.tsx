import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import MintJar from '@/components/MintJar';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore } from '@/store/gameStore';

interface KindnessJarSectionProps {
  userId: string | null;
  authResolved: boolean;
  totalSent: number;
}

const KindnessJarSection = ({ userId, authResolved, totalSent }: KindnessJarSectionProps) => {
  const refreshTick = useGameStore((s) => s.refreshTick);
  const [liveJarCount, setLiveJarCount] = useState<number>(0);

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    if (!userId) {
      setLiveJarCount(0);
      return;
    }

    let cancelled = false;
    (async () => {
      // Canonical source: SUM(amount) from mint_transactions for this user
      const { data, error } = await supabase
        .from('mint_transactions')
        .select('amount')
        .eq('user_id', userId);
      if (cancelled || error || !data) return;
      const sum = data.reduce((acc, row) => acc + (row.amount ?? 0), 0);
      setLiveJarCount(sum);
    })();
    return () => { cancelled = true; };
  }, [userId, authResolved, refreshTick]);

  return (
    <motion.div
      className="bg-card rounded-2xl p-6 shadow-lg border border-border h-full flex flex-col items-center justify-center min-h-[280px]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, type: 'spring' }}
    >
      <MintJar jarCount={liveJarCount} totalSent={totalSent} />
    </motion.div>
  );
};

export default KindnessJarSection;

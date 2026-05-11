import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import MintJar from '@/components/MintJar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGameStore } from '@/store/gameStore';

interface KindnessJarSectionProps {
  totalSent: number;
}

const KindnessJarSection = ({ totalSent }: KindnessJarSectionProps) => {
  const { user } = useAuth();
  const refreshTick = useGameStore((s) => s.refreshTick);
  const [liveJarCount, setLiveJarCount] = useState<number>(0);

  useEffect(() => {
    if (!user?.id) {
      setLiveJarCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      // Canonical source: SUM(amount) from mint_transactions for this user
      const { data, error } = await supabase
        .from('mint_transactions')
        .select('amount')
        .eq('user_id', user.id);
      if (cancelled || error || !data) return;
      const sum = data.reduce((acc, row) => acc + (row.amount ?? 0), 0);
      setLiveJarCount(sum);
    })();
    return () => { cancelled = true; };
  }, [user?.id, refreshTick]);

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

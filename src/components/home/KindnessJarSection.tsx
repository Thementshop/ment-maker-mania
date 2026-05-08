import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import MintJar from '@/components/MintJar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface KindnessJarSectionProps {
  jarCount: number;
  totalSent: number;
}

const KindnessJarSection = ({ jarCount, totalSent }: KindnessJarSectionProps) => {
  const { user } = useAuth();
  const [liveJarCount, setLiveJarCount] = useState<number>(jarCount);

  useEffect(() => {
    if (!user?.id) {
      setLiveJarCount(jarCount);
      return;
    }
    let cancelled = false;
    (async () => {
      // Kindness Jar = SUM(amount) from mint_transactions for this user
      const { data, error } = await supabase
        .from('mint_transactions')
        .select('amount')
        .eq('user_id', user.id);
      if (cancelled) return;
      if (error || !data) {
        setLiveJarCount(jarCount);
        return;
      }
      const sum = data.reduce((acc, row) => acc + (row.amount ?? 0), 0);
      setLiveJarCount(sum);
    })();
    return () => { cancelled = true; };
  }, [user?.id, jarCount, totalSent]);

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

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { complimentCategories } from '@/data/compliments';
import { motion } from 'framer-motion';

interface MentData {
  compliment_text: string;
  category: string;
  sent_at: string | null;
}

const MentPage = () => {
  const { mentId } = useParams<{ mentId: string }>();
  const [ment, setMent] = useState<MentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMent = async () => {
      if (!mentId) {
        setError('No ment ID provided');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('sent_ments')
        .select('compliment_text, category, sent_at')
        .eq('id', mentId)
        .maybeSingle();

      if (fetchError) {
        setError('Could not load this ment');
      } else if (!data) {
        setError('Ment not found');
      } else {
        setMent(data);
      }
      setLoading(false);
    };

    fetchMent();
  }, [mentId]);

  const categoryInfo = ment
    ? complimentCategories.find((c) => c.id === ment.category)
    : null;

  const appUrl = 'https://ment-maker-mania.lovable.app';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-muted-foreground font-display text-lg"
        >
          Loading your ment...
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <p className="text-4xl mb-4">😔</p>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Oops!</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <a
          href={appUrl}
          className="inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to Ment Shop →
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl bg-card p-8 shadow-2xl text-center"
      >
        {categoryInfo && (
          <span className="text-5xl mb-4 block">{categoryInfo.emoji}</span>
        )}

        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
          Someone sent you a ment! 💚
        </h1>

        <p className="text-sm text-muted-foreground mb-6">
          {categoryInfo ? categoryInfo.name : 'A kind compliment'}
        </p>

        <div className="rounded-2xl bg-primary/5 border-2 border-primary/20 p-6 mb-6">
          <p className="text-foreground text-lg leading-relaxed font-medium">
            "{ment!.compliment_text}"
          </p>
        </div>

        {ment!.sent_at && (
          <p className="text-xs text-muted-foreground mb-6">
            Sent on {new Date(ment!.sent_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}

        <div className="space-y-3">
          <a
            href={appUrl}
            className="block w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Send a Ment Back 💚
          </a>
          <p className="text-xs text-muted-foreground">
            No timer, no pressure – just spread kindness!
          </p>
        </div>
      </motion.div>

      <p className="mt-8 text-xs text-muted-foreground">
        💚 Ment Shop – Spreading Kindness, One Compliment at a Time
      </p>
    </div>
  );
};

export default MentPage;

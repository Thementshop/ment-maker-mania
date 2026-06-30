import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFreshAccessToken } from '@/utils/freshToken';

interface MentSafetyActionsProps {
  mentId: string;
  senderId: string | null;
}

/**
 * Understated post-reveal safety actions for a Ment recipient:
 *  - Report this Ment (notifies the team for review)
 *  - Block this sender (no future Ments; the sender is never notified)
 *
 * Kept deliberately quiet so it never competes with the primary CTAs.
 */
const MentSafetyActions = ({ mentId, senderId }: MentSafetyActionsProps) => {
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [blockState, setBlockState] = useState<'idle' | 'sending' | 'done'>('idle');

  const handleReport = async () => {
    if (reportState !== 'idle') return;
    setReportState('sending');
    try {
      const accessToken = await getFreshAccessToken();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-ment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ ment_id: mentId }),
      });
    } catch (err) {
      console.error('[MentSafetyActions] report failed:', err);
    }
    // Always reassure the user, even if the network hiccuped — the report is best-effort.
    setReportState('done');
  };

  const handleBlock = async () => {
    if (!senderId || blockState !== 'idle') return;
    setBlockState('sending');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBlockState('idle');
      setBlockConfirm(false);
      return;
    }
    const { error } = await supabase.from('blocked_senders').insert({
      blocker_user_id: user.id,
      blocked_user_id: senderId,
    });
    if (error) console.error('[MentSafetyActions] block failed:', error);
    setBlockState('done');
    setBlockConfirm(false);
  };

  return (
    <div className="mt-4 space-y-2 text-center">
      {/* ─── Report ─── */}
      {reportState === 'done' ? (
        <p className="text-xs text-muted-foreground">
          Thank you for letting us know. We take every report seriously and will review this right away.
        </p>
      ) : (
        <button
          onClick={handleReport}
          disabled={reportState === 'sending'}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          This didn't sound like a compliment? Let us take care of it.
        </button>
      )}

      {/* ─── Block ─── */}
      {senderId && (
        blockState === 'done' ? (
          <p className="text-xs text-muted-foreground">
            Blocked. You won't receive Ments from this person anymore.
          </p>
        ) : blockConfirm ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Block this person? You won't receive any Ments from them in the future. They won't be notified.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={handleBlock}
                disabled={blockState === 'sending'}
                className="rounded-lg bg-foreground/90 px-3 py-1 text-xs font-semibold text-background disabled:opacity-50"
              >
                Block
              </button>
              <button
                onClick={() => setBlockConfirm(false)}
                className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setBlockConfirm(true)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Block this sender
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default MentSafetyActions;

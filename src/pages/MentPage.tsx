import { useEffect, useState, useContext } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { complimentCategories } from '@/data/compliments';
import { motion, AnimatePresence } from 'framer-motion';
import wrappedMint from '@/assets/wrapped-mint.png';
import unwrappedMint from '@/assets/unwrapped-mint.png';
import brandMint from '@/assets/brand-mint.png';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pause } from 'lucide-react';
import { toast } from 'sonner';

interface MentData {
  compliment_text: string;
  category: string;
  sent_at: string | null;
  sender_name: string;
  recipient_expires_at: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const MentPage = () => {
  const { mentId } = useParams<{ mentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const authCtx = useContext(AuthContext);
  const isLoggedIn = !!authCtx?.user;

  // Share-mode: viewer is NOT the original recipient. No login token, different CTAs.
  const isShareMode =
    location.pathname.endsWith('/shared') || location.pathname.startsWith('/share/');

  const [ment, setMent] = useState<MentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unwrapped, setUnwrapped] = useState(false);
  // After unwrap, logged-in private-link users get a one-tap choice:
  // resend the same compliment, or pick something new.
  const [showSendBackChoice, setShowSendBackChoice] = useState(false);
  const [pauseTokens, setPauseTokens] = useState<number | null>(null);
  const [extending, setExtending] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Load pause-token balance for logged-in private-link recipients
  useEffect(() => {
    if (!isLoggedIn || isShareMode || !authCtx?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('pause_tokens')
        .eq('id', authCtx.user!.id)
        .maybeSingle();
      setPauseTokens(data?.pause_tokens ?? 0);
    })();
  }, [isLoggedIn, isShareMode, authCtx?.user?.id]);

  const handleUsePauseToken = async () => {
    if (!mentId || extending) return;
    if ((pauseTokens ?? 0) <= 0) {
      navigate('/store');
      return;
    }
    setExtending(true);
    const { data, error: rpcErr } = await supabase.rpc('extend_single_ment_timer' as never, {
      _ment_id: mentId,
    } as never);
    setExtending(false);
    const result = data as { success?: boolean; new_expires_at?: string; tokens_remaining?: number; error?: string } | null;
    if (rpcErr || !result?.success) {
      toast.error('Could not extend timer. Please try again.');
      return;
    }
    setPauseTokens(result.tokens_remaining ?? Math.max(0, (pauseTokens ?? 1) - 1));
    setMent((prev) => prev ? { ...prev, recipient_expires_at: result.new_expires_at ?? prev.recipient_expires_at } : prev);
    setPopoverOpen(false);
    toast.success('Timer extended! ⏰ You have 48 more hours to keep this mint.');
  };

  // ─── Step 1: Silent auto-login from ?token=… or lazy ?auto=1 (private delivery links only) ───
  useEffect(() => {
    if (isShareMode) return;
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const auto = params.get('auto');

    // Strip params from URL bar immediately (no flash, no history entry).
    if (token || auto) {
      window.history.replaceState({}, '', location.pathname);
    }

    if (isLoggedIn) return; // Already logged in — token not needed.

    // Silently verify. No UI, no redirect, no toast. If it fails, page works as-is.
    (async () => {
      try {
        if (token) {
          await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' });
        } else if (auto === '1' && mentId) {
          // Lazy path: ask backend to issue a token now (cached) and verify it.
          const { data, error: tokErr } = await supabase.functions.invoke('issue-reveal-token', {
            body: { ment_id: mentId },
          });
          if (!tokErr && data?.has_token && data?.token) {
            await supabase.auth.verifyOtp({ token_hash: data.token, type: 'magiclink' });
          }
        }
      } catch (err) {
        console.warn('[MentPage] Silent login failed (non-fatal):', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchMent = async () => {
      if (!mentId) {
        setError("This ment has already been unwrapped or doesn't exist");
        setLoading(false);
        return;
      }

      try {
        const mentRes = await fetch(
          `${SUPABASE_URL}/rest/v1/sent_ments?id=eq.${mentId}&select=compliment_text,category,sent_at,sender_id,recipient_expires_at`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        const mentRows = await mentRes.json();

        if (!mentRes.ok || !mentRows?.length) {
          setError("This ment has already been unwrapped or doesn't exist");
          setLoading(false);
          return;
        }

        const data = mentRows[0];

        let senderName = 'Someone';
        if (data.sender_id) {
          const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.sender_id}&select=display_name`,
            {
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
              },
            }
          );
          const profiles = await profileRes.json();
          if (profiles?.[0]?.display_name) {
            senderName = profiles[0].display_name;
          }
        }

        setMent({
          compliment_text: data.compliment_text,
          category: data.category,
          sent_at: data.sent_at,
          sender_name: senderName,
          recipient_expires_at: data.recipient_expires_at ?? null,
        });
      } catch {
        setError("This ment has already been unwrapped or doesn't exist");
      }
      setLoading(false);
    };

    fetchMent();
  }, [mentId]);

  const handleUnwrap = () => {
    setUnwrapped(true);
    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#58fc59', '#FF6B9D', '#4FC3F7', '#FFD740', '#B39DDB'],
      });
    }, 800);
  };

  const categoryInfo = ment
    ? complimentCategories.find((c) => c.id === ment.category)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)' }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="font-display text-lg"
          style={{ color: '#166534' }}
        >
          Loading your ment...
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)' }}>
        <img src={brandMint} alt="Ment" className="h-20 w-20 object-contain mb-4" />
        <h1 className="font-display text-2xl font-bold mb-2" style={{ color: '#166534' }}>
          Oops!
        </h1>
        <p className="text-muted-foreground mb-8 max-w-sm">{error}</p>
        <Link
          to="/auth"
          className="inline-block rounded-xl px-8 py-3 font-semibold text-white transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
        >
          Join The Ment Shop →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)' }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center"
        style={{ boxShadow: '0 25px 60px -12px rgba(88, 252, 89, 0.25)' }}
      >
        <AnimatePresence mode="wait">
          {!unwrapped ? (
            <motion.div
              key="wrapped"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, -3, 3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <img src={wrappedMint} alt="Wrapped ment" className="h-40 w-40 object-contain" />
              </motion.div>

              <h1 className="font-display text-2xl font-bold mt-6 mb-2" style={{ color: '#166534' }}>
                You received a ment! 🎁
              </h1>
              <p className="text-muted-foreground text-sm mb-8">
                Someone sent you a little kindness
              </p>

              <motion.button
                onClick={handleUnwrap}
                className="w-full rounded-xl px-8 py-4 font-bold text-white text-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                💚 Tap to Unwrap
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="unwrapped"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3, type: 'spring', bounce: 0.5 }}
              >
                <img src={unwrappedMint} alt="Unwrapped ment" className="h-28 w-28 object-contain" />
              </motion.div>

              {categoryInfo && (
                <motion.span
                  className="text-4xl mt-3 block"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring', bounce: 0.6 }}
                >
                  {categoryInfo.emoji}
                </motion.span>
              )}

              <motion.div
                className="rounded-2xl p-6 my-5 w-full"
                style={{ background: 'linear-gradient(135deg, rgba(88,252,89,0.08), rgba(88,252,89,0.15))', border: '2px solid rgba(88,252,89,0.3)' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <p className="text-foreground text-lg leading-relaxed font-semibold">
                  "{ment!.compliment_text}"
                </p>
              </motion.div>

              <motion.p
                className="text-sm mb-6"
                style={{ color: '#166534' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {isShareMode ? (
                  <>💚 A little kindness from <strong>{ment!.sender_name}</strong></>
                ) : isLoggedIn ? (
                  <>You have <strong>48 hours</strong> to send one back to <strong>{ment!.sender_name}</strong> or brighten someone new's day to add this mint to your jar. 💚</>
                ) : (
                  <>Want to add this mint to your Kindness Jar? Create a free account and you'll have <strong>48 hours</strong> to pass the kindness forward.</>
                )}
              </motion.p>

              {isLoggedIn && !isShareMode && pauseTokens !== null && (
                <div className="w-full flex justify-end mb-3">
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        aria-label="Use Pause Token"
                        className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, #fde68a, #d4a017 70%, #8a6a08)',
                          border: '1px solid rgba(120, 90, 10, 0.5)',
                        }}
                      >
                        <Pause className="w-4 h-4 fill-[#7a5a08] text-[#7a5a08]" strokeWidth={0} />
                        <span
                          className="absolute -bottom-1 -right-1 text-[10px] font-bold text-white rounded-full px-1.5 py-0.5 leading-none"
                          style={{ background: '#166534', minWidth: '16px', textAlign: 'center' }}
                        >
                          {pauseTokens}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">
                      {pauseTokens > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm">
                            You have <strong>{pauseTokens}</strong> Pause Token{pauseTokens === 1 ? '' : 's'}. Use one to get 48 more hours to pass this mint forward.
                          </p>
                          <button
                            onClick={handleUsePauseToken}
                            disabled={extending}
                            className="w-full rounded-lg px-4 py-2 font-semibold text-white text-sm disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                          >
                            {extending ? 'Extending…' : 'Use Pause Token'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm">
                            No Pause Tokens left. Get more time with Pause Tokens in the store.
                          </p>
                          <Link
                            to="/store"
                            className="block w-full rounded-lg px-4 py-2 font-semibold text-white text-sm text-center"
                            style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                          >
                            Go to Store
                          </Link>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <motion.div
                className="space-y-3 w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                {isShareMode ? (
                  // ─── Share-link viewer: not the original recipient ───
                  isLoggedIn ? (
                    <Link
                      to="/"
                      className="block w-full rounded-xl px-6 py-3 font-semibold text-white text-center transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                    >
                      Join The Ment Shop 💚
                    </Link>
                  ) : (
                    <Link
                      to="/auth"
                      className="block w-full rounded-xl px-6 py-3 font-semibold text-white text-center transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                    >
                      Join The Ment Shop 💚
                    </Link>
                  )
                ) : isLoggedIn ? (
                  // ─── Private link, logged in: send back / send new ───
                  <>
                    <button
                      onClick={() => setShowSendBackChoice(true)}
                      className="block w-full rounded-xl px-6 py-3 font-semibold text-white text-center transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                    >
                      Send a Ment Back to {ment!.sender_name} 💚
                    </button>
                    <button
                      onClick={() => {
                        sessionStorage.setItem('openSendMent', '1');
                        navigate('/');
                      }}
                      className="block w-full rounded-xl px-6 py-3 font-semibold text-center transition-all hover:scale-[1.02] border-2"
                      style={{ borderColor: '#58fc59', color: '#166534' }}
                    >
                      Send to Someone New
                    </button>
                  </>
                ) : (
                  // ─── Private link, not logged in: new user ───
                  <>
                    <Link
                      to="/auth"
                      className="block w-full rounded-xl px-6 py-3 font-semibold text-white text-center transition-all hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                    >
                      Create Free Account
                    </Link>
                    <Link
                      to="/auth?mode=signin"
                      className="block w-full text-center text-sm transition-colors hover:underline"
                      style={{ color: '#166534' }}
                    >
                      Already have an account? Sign in
                    </Link>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="mt-8 text-xs" style={{ color: '#6b7280' }}>
        💚 Ment Shop – Spreading Kindness, One Compliment at a Time
      </p>

      {/* ── Quick "Send Back" choice screen ───────────────────────────────
          Logged-in private-link recipients can either resend the same
          compliment or pick something new. One tap → straight to recipient. */}
      <AnimatePresence>
        {showSendBackChoice && ment && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSendBackChoice(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <h2 className="font-display text-xl font-bold text-center mb-1" style={{ color: '#166534' }}>
                Pass it forward 💚
              </h2>
              <p className="text-center text-sm text-muted-foreground mb-5">
                Send the same kindness, or pick something fresh.
              </p>

              {/* The compliment they just received, with one-tap resend */}
              <div
                className="rounded-2xl p-4 mb-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(88,252,89,0.08), rgba(88,252,89,0.15))',
                  border: '2px solid rgba(88,252,89,0.3)',
                }}
              >
                <p className="text-foreground text-base leading-relaxed font-semibold italic mb-4">
                  "{ment.compliment_text}"
                </p>
                <button
                  onClick={() => {
                    sessionStorage.setItem('openSendMent', '1');
                    sessionStorage.setItem('sendMentPrefillCompliment', ment.compliment_text);
                    sessionStorage.setItem('sendMentPrefillCategory', ment.category);
                    sessionStorage.setItem('sendMentSenderName', ment.sender_name);
                    navigate('/');
                  }}
                  className="block w-full rounded-xl px-6 py-3 font-semibold text-white text-center transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #58fc59, #3dd83e)' }}
                >
                  Send this same Ment 💚
                </button>
              </div>

              <button
                onClick={() => {
                  sessionStorage.setItem('openSendMent', '1');
                  sessionStorage.setItem('sendMentSenderName', ment.sender_name);
                  navigate('/');
                }}
                className="block w-full rounded-xl px-6 py-3 font-semibold text-center transition-all hover:scale-[1.02] border-2"
                style={{ borderColor: '#58fc59', color: '#166534' }}
              >
                Choose something new instead →
              </button>

              <button
                onClick={() => setShowSendBackChoice(false)}
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MentPage;

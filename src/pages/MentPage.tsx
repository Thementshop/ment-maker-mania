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

interface MentData {
  compliment_text: string;
  category: string;
  sent_at: string | null;
  sender_name: string;
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

  // ─── Step 1: Silent auto-login from ?token=… (private delivery links only) ───
  useEffect(() => {
    if (isShareMode) return;
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) return;

    // Strip the token from the URL bar immediately (no flash, no history entry).
    const cleanUrl = location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (isLoggedIn) return; // Already logged in — token not needed.

    // Silently verify. No UI, no redirect, no toast. If it fails, page works as-is.
    (async () => {
      try {
        await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' });
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
          `${SUPABASE_URL}/rest/v1/sent_ments?id=eq.${mentId}&select=compliment_text,category,sent_at,sender_id`,
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
                💚 No timer, no pressure — just kindness from <strong>{ment!.sender_name}</strong>
              </motion.p>

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
                      onClick={() => {
                        sessionStorage.setItem('openSendMent', '1');
                        sessionStorage.setItem('sendMentSenderName', ment!.sender_name);
                        navigate('/');
                      }}
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
    </div>
  );
};

export default MentPage;

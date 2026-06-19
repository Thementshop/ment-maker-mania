import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useAuth } from '@/contexts/AuthContext';
import { useChainNotifications } from '@/hooks/useChainNotifications';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SendAMentModal from '@/components/SendAMentModal';
import LevelUpModal from '@/components/LevelUpModal';
import OnboardingModal from '@/components/OnboardingModal';
import SendMentSection from '@/components/home/SendMentSection';
import KindnessJarSection from '@/components/home/KindnessJarSection';
import YourChainsCard from '@/components/home/YourChainsCard';
import ChainDashboard from '@/components/chains/ChainDashboard';
import StartChainModal from '@/components/chains/StartChainModal';
import tmsBanner from '@/assets/TMS_banner.png';
import brandMint from '@/assets/brand-mint.png';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFreshAccessToken } from '@/utils/freshToken';

const Index = () => {
  useChainNotifications();
  const { user, session, isLoading: authIsLoading } = useAuth();
  const {
    jarCount,
    totalSent,
    pendingMents,
    worldKindnessCount,
    isLoading,
    sendMent,
    loadGameState,
    refreshTick,
  } = useGameStore();

  const [isSendAMentOpen, setIsSendAMentOpen] = useState(false);
  const [isStartChainOpen, setIsStartChainOpen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpBonus, setLevelUpBonus] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [prefilledCompliment, setPrefilledCompliment] = useState<string | null>(null);
  const [prefilledCategory, setPrefilledCategory] = useState<string | null>(null);
  const [prefilledSenderName, setPrefilledSenderName] = useState<string | null>(null);
  const [liveJarCount, setLiveJarCount] = useState(0);
  const [liveMentsSent, setLiveMentsSent] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
    // Auto-open Send-a-Ment modal when redirected from MentPage post-reveal CTAs.
    if (sessionStorage.getItem('openSendMent') === '1') {
      sessionStorage.removeItem('openSendMent');
      // Optional prefill: when the user chose "Send this same Ment" on MentPage.
      const pComp = sessionStorage.getItem('sendMentPrefillCompliment');
      const pCat = sessionStorage.getItem('sendMentPrefillCategory');
      const pSender = sessionStorage.getItem('sendMentSenderName');
      if (pComp) {
        setPrefilledCompliment(pComp);
        setPrefilledCategory(pCat);
        setPrefilledSenderName(pSender);
        sessionStorage.removeItem('sendMentPrefillCompliment');
        sessionStorage.removeItem('sendMentPrefillCategory');
      }
      sessionStorage.removeItem('sendMentSenderName');
      setIsSendAMentOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadGameState(user.id, session?.access_token)
      .catch(() => undefined);
  }, [user?.id, session?.access_token, loadGameState]);

  useEffect(() => {
    if (authIsLoading) return;

    if (!user?.id) {
      setLiveJarCount(0);
      setLiveMentsSent(0);
      return;
    }

    let cancelled = false;

    (async () => {
      const token = (await getFreshAccessToken()) || session?.access_token || null;
      if (!token) return;

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      try {
        const [mintRes, sentRes, chainRes] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/mint_transactions?select=amount&user_id=eq.${user.id}`, {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          }),
          fetch(`${baseUrl}/rest/v1/sent_ments?select=id&sender_id=eq.${user.id}&limit=1`, {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${token}`,
              Prefer: 'count=exact',
            },
            signal: controller.signal,
          }),
          fetch(`${baseUrl}/rest/v1/chain_links?select=link_id&passed_by=eq.${user.id}&limit=1`, {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${token}`,
              Prefer: 'count=exact',
            },
            signal: controller.signal,
          }),
        ]);

        if (!mintRes.ok || !sentRes.ok || !chainRes.ok) return;

        const mintRows = await mintRes.json();
        const singles = Number(sentRes.headers.get('content-range')?.split('/')[1] ?? 0);
        const chainSends = Number(chainRes.headers.get('content-range')?.split('/')[1] ?? 0);

        if (cancelled) return;

        const jarTotal = (mintRows ?? []).reduce((sum: number, row: { amount: number | null }) => sum + (row.amount ?? 0), 0);
        setLiveJarCount(jarTotal);
        setLiveMentsSent(singles + chainSends);
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authIsLoading, refreshTick]);

  return (
    <div className="min-h-screen bg-gradient-mint flex flex-col">
      <Header worldCount={worldKindnessCount} />

      <div className="w-full">
        <img
          src={tmsBanner}
          alt="Welcome to The Ment Shop - The Candy Store of Compliments"
          className="w-full max-h-[400px] object-contain object-center"
        />
      </div>

      <main className="container flex-1 py-6 sm:py-8 pb-24 px-4">
        {/* TEMP: payment testing — remove after testing */}
        <div className="mb-4 flex justify-center">
          <Link
            to="/store"
            className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-primary bg-primary/10 px-5 py-2 font-display text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
          > Open Store (test)
          </Link>
        </div>

        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            {/* Left: Kindness Jar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <KindnessJarSection totalSent={liveMentsSent} jarCount={liveJarCount} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-1.5">
                  Collect mints by sending kindness!
                  <img src={brandMint} alt="" className="h-4 w-4 object-contain" />
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Center: Send A Ment (graphic button) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SendMentSection onOpenModal={() => setIsSendAMentOpen(true)} lifetimeSent={liveMentsSent} />
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Send a compliment to earn mints!</p></TooltipContent>
            </Tooltip>

            {/* Right: Your Chains summary */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <YourChainsCard onStartChain={() => setIsStartChainOpen(true)} />
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Spread kindness in a BIG WAY</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <section id="chains" className="mt-8">
          <ChainDashboard />
        </section>
      </main>

      {/* Send A Ment Modal (single, no chain) */}
      <SendAMentModal
        isOpen={isSendAMentOpen}
        onClose={() => {
          setIsSendAMentOpen(false);
          setPrefilledCompliment(null);
          setPrefilledCategory(null);
          setPrefilledSenderName(null);
        }}
        prefilledCompliment={prefilledCompliment}
        prefilledCategory={prefilledCategory}
        prefilledSenderName={prefilledSenderName}
      />

      {/* Start Chain Modal from card */}
      <StartChainModal isOpen={isStartChainOpen} onClose={() => setIsStartChainOpen(false)} onSuccess={() => {}} />

      <LevelUpModal isOpen={showLevelUp} onClose={() => setShowLevelUp(false)} totalSent={totalSent} bonusMints={levelUpBonus} />
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        mintCount={liveJarCount}
        isNewSignup={sessionStorage.getItem('justSignedUp') === '1'}
      />
      <Footer />
    </div>
  );
};

export default Index;

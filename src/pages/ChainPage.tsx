import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Clock, User, ArrowRight, Share2, Flame, AlertTriangle, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuth } from '@/contexts/AuthContext';
import { tierConfig, getChainTier, getVisualTier, visualTierConfig } from '@/utils/chainTiers';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import PassChainModal from '@/components/chains/PassChainModal';
import MintCircleGraphic from '@/components/chains/MintCircleGraphic';
import { getShareBaseUrl } from '@/utils/getBaseUrl';

interface ChainData {
  chain_id: string;
  chain_name: string | null;
  share_count: number | null;
  tier: string | null;
  expires_at: string;
  started_by: string;
  current_holder: string;
  status: string;
  created_at: string;
  started_by_display_name?: string;
  current_holder_display_name?: string;
  received_compliment?: string;
}

// --- Subcomponents ---

const ChainLoadingSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="w-full max-w-md space-y-6">
      <Skeleton className="h-48 w-48 rounded-full mx-auto" />
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  </div>
);

const ChainNotFound = ({ onGoHome }: { onGoHome: () => void }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="text-center space-y-4">
      <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto" />
      <h1 className="text-2xl font-bold">Chain Not Found</h1>
      <p className="text-muted-foreground">This chain may have been broken or doesn't exist.</p>
      <Button onClick={onGoHome}>Go Home</Button>
    </div>
  </div>
);

const ChainBroken = ({ chain, onBack }: { chain: ChainData; onBack: () => void }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6 max-w-md"
    >
      <div className="text-6xl">💔</div>
      <h1 className="text-2xl font-bold">Chain Broken</h1>
      <p className="text-muted-foreground">
        This kindness chain "{chain.chain_name || 'Untitled'}" has ended after {chain.share_count} shares.
      </p>
      <Button onClick={onBack}>View Your Chains</Button>
    </motion.div>
  </div>
);

const CurrentHolderView = ({
  chain,
  countdown,
  urgency,
  tier,
  config,
  showPassModal,
  setShowPassModal,
  onPassSuccess,
}: {
  chain: ChainData;
  countdown: ReturnType<typeof useCountdown>;
  urgency: { color: string; bg: string; animate: boolean; icon: string };
  tier: string;
  config: typeof tierConfig.small;
  showPassModal: boolean;
  setShowPassModal: (v: boolean) => void;
  onPassSuccess: () => void;
}) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md text-center space-y-6"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-3xl">{config.emoji}</span>
        <h1 className="text-2xl font-bold">{chain.chain_name || 'Kindness Chain'}</h1>
      </div>

      <motion.div
        className={`${urgency.bg} rounded-2xl p-8 ${urgency.animate ? 'animate-pulse' : ''}`}
        animate={urgency.animate ? { scale: [1, 1.02, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1 }}
      >
        <p className="text-sm text-muted-foreground mb-2">TIME REMAINING</p>
        <p className={`text-5xl font-mono font-bold ${urgency.color}`}>
          {urgency.icon} {countdown.formattedTime}
        </p>
        {countdown.hours < 2 && (
          <p className="text-sm text-red-500 mt-2 flex items-center justify-center gap-1">
            <Flame className="h-4 w-4" />
            Don't let the chain break!
          </p>
        )}
      </motion.div>

      <div className="bg-muted/50 rounded-xl p-4 text-left">
        <p className="text-sm text-muted-foreground mb-1">💚 From @{chain.started_by_display_name}:</p>
        <p className="italic text-foreground">
          "{chain.received_compliment || "You're amazing and the world is better with you in it!"}"
        </p>
      </div>

      <div className="flex justify-center gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Link className="h-4 w-4" />
          <strong className="text-foreground">{chain.share_count}</strong> shares
        </span>
        <span className="flex items-center gap-1">
          <User className="h-4 w-4" />
          @{chain.started_by_display_name}
        </span>
      </div>

      <Button
        size="lg"
        className="w-full rounded-full text-lg py-6"
        onClick={() => setShowPassModal(true)}
      >
        Pass It Forward <ArrowRight className="h-5 w-5 ml-2" />
      </Button>

      <p className="text-xs text-muted-foreground">
        Add your compliment and send to someone special
      </p>

      <PassChainModal
        chain={{
          chain_id: chain.chain_id,
          chain_name: chain.chain_name || 'Kindness Chain',
          share_count: chain.share_count || 1,
          started_by: chain.started_by,
          current_holder: chain.current_holder,
          tier: tier as 'small' | 'medium' | 'large' | 'legendary',
        }}
        receivedCompliment={chain.received_compliment || "You're amazing!"}
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        onSuccess={onPassSuccess}
      />
    </motion.div>
  </div>
);

const StarterView = ({
  chain,
  countdown,
  urgency,
  tier,
  handleShare,
  onBack,
}: {
  chain: ChainData;
  countdown: ReturnType<typeof useCountdown>;
  urgency: { color: string; bg: string; animate: boolean; icon: string };
  tier: string;
  handleShare: () => void;
  onBack: () => void;
}) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md text-center space-y-6"
    >
      <div className="w-32 h-32 mx-auto">
        <MintCircleGraphic shareCount={chain.share_count || 1} tier={tier as 'small' | 'medium' | 'large' | 'legendary'} />
      </div>
      <div>
        <h1 className="text-2xl font-bold">{chain.chain_name || 'Your Kindness Chain'}</h1>
        <p className="text-muted-foreground">Chain you started</p>
      </div>
      <div className="bg-muted/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current Holder</span>
          <span className="font-medium text-primary">@{chain.current_holder_display_name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Time Remaining</span>
          <span className={`font-mono font-medium ${urgency.color}`}>
            {urgency.icon} {countdown.formattedTime}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Shares</span>
          <span className="font-medium">{chain.share_count}</span>
        </div>
      </div>
      <Button variant="outline" className="w-full rounded-full" onClick={handleShare}>
        <Share2 className="h-4 w-4 mr-2" />
        Share Chain Link
      </Button>
      <Button variant="ghost" onClick={onBack}>
        ← Back to Dashboard
      </Button>
    </motion.div>
  </div>
);

// --- Reveal View (recipient / public) ---

const RevealView = ({
  chain,
  countdown,
  urgency,
  tier,
  user,
  chainId,
  handleShare,
  onNavigate,
  showPassModal,
  setShowPassModal,
  onPassSuccess,
}: {
  chain: ChainData;
  countdown: ReturnType<typeof useCountdown>;
  urgency: { color: string; bg: string; animate: boolean; icon: string };
  tier: string;
  user: any;
  chainId: string;
  handleShare: () => void;
  onNavigate: (path: string) => void;
  showPassModal: boolean;
  setShowPassModal: (v: boolean) => void;
  onPassSuccess: () => void;
}) => {
  const [revealed, setRevealed] = useState(false);
  const visualTier = getVisualTier(chain.share_count || 1);
  const vtConfig = visualTierConfig[visualTier];
  const compliment = chain.received_compliment || "You're amazing and the world is better with you in it!";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center space-y-6"
      >
        {/* Mint graphic */}
        <div className="w-36 h-36 mx-auto">
          <MintCircleGraphic shareCount={chain.share_count || 1} tier={tier as 'small' | 'medium' | 'large' | 'legendary'} />
        </div>

        {/* Chain name */}
        <h1 className="text-2xl font-bold">{chain.chain_name || 'Kindness Chain'}</h1>

        {/* From sender */}
        <p className="text-muted-foreground">
          From <span className="text-foreground font-medium">@{chain.started_by_display_name}</span>
        </p>

        {/* Tier badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
          <span>{vtConfig.emoji}</span>
          <span className="font-medium">{vtConfig.label}</span>
        </div>

        {/* Reveal area */}
        {!revealed ? (
          <motion.button
            onClick={() => setRevealed(true)}
            className="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 cursor-pointer group transition-colors hover:border-primary/70 hover:bg-primary/10"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Gift className="h-10 w-10 mx-auto text-primary/60 group-hover:text-primary transition-colors mb-3" />
            <p className="text-lg font-semibold text-foreground">Tap to reveal your compliment</p>
            <p className="text-sm text-muted-foreground mt-1">A little kindness is waiting for you 💚</p>
          </motion.button>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* Compliment card */}
              <div className="rounded-2xl bg-primary/10 border border-primary/20 p-6">
                <p className="text-xl italic font-medium text-foreground leading-relaxed">
                  "{compliment}"
                </p>
                <p className="text-sm text-muted-foreground mt-3">
                  — sent with love from @{chain.started_by_display_name}
                </p>
              </div>

              {/* Chain stats */}
              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Link className="h-4 w-4" />
                  <strong className="text-foreground">{chain.share_count}</strong> shares
                </span>
                <span className={`flex items-center gap-1 font-mono ${urgency.color}`}>
                  <Clock className="h-4 w-4" />
                  {countdown.formattedTime}
                </span>
              </div>

              {/* CTAs based on auth state */}
              {user ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You have <span className={`font-mono font-bold ${urgency.color}`}>{countdown.formattedTime}</span> to pass it forward
                  </p>
                  <Button
                    size="lg"
                    className="w-full rounded-full text-lg py-6"
                    onClick={() => setShowPassModal(true)}
                  >
                    Pass It Forward <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                  <Button variant="outline" className="w-full rounded-full" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share This Chain
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-base font-medium text-foreground">
                    Love this? Keep the kindness going! 🎁
                  </p>
                  <Button
                    size="lg"
                    className="w-full rounded-full text-lg py-6"
                    onClick={() => onNavigate(`/auth?returnTo=/chain/${chainId}`)}
                  >
                    Create Free Account to Pass It Forward
                  </Button>
                  <button
                    onClick={() => onNavigate(`/auth?mode=login&returnTo=/chain/${chainId}`)}
                    className="text-sm text-primary hover:underline"
                  >
                    Already have an account? Sign In
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Join the chain and earn mints in your Kindness Jar! 🌿
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        <Button variant="ghost" onClick={() => onNavigate('/')}>
          ← Go Home
        </Button>
      </motion.div>

      {user && (
        <PassChainModal
          chain={{
            chain_id: chain.chain_id,
            chain_name: chain.chain_name || 'Kindness Chain',
            share_count: chain.share_count || 1,
            started_by: chain.started_by,
            current_holder: chain.current_holder,
            tier: tier as 'small' | 'medium' | 'large' | 'legendary',
          }}
          receivedCompliment={chain.received_compliment || "You're amazing!"}
          isOpen={showPassModal}
          onClose={() => setShowPassModal(false)}
          onSuccess={onPassSuccess}
        />
      )}
    </div>
  );
};

// --- Main Component ---

const ChainPage = () => {
  const { chainId } = useParams<{ chainId: string }>();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [showPassModal, setShowPassModal] = useState(false);

  const { data: chain, isLoading, error } = useQuery({
    queryKey: ['chain-page', chainId, user?.id],
    queryFn: async (): Promise<ChainData | null> => {
      if (!chainId) return null;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const token = session?.access_token || apiKey;

        const chainRes = await fetch(
          `${baseUrl}/rest/v1/ment_chains?select=*&chain_id=eq.${chainId}`,
          {
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.pgrst.object+json',
            },
            signal: controller.signal,
          }
        );

        if (!chainRes.ok) throw new Error(`Chain fetch failed: ${chainRes.status}`);
        const chainData = await chainRes.json();

        const userIds = [chainData.started_by];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(chainData.current_holder)) {
          userIds.push(chainData.current_holder);
        }

        const profileRes = await fetch(
          `${baseUrl}/rest/v1/profiles?select=id,display_name&id=in.(${userIds.join(',')})`,
          {
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          }
        );
        const profiles = profileRes.ok ? await profileRes.json() : [];
        const profileMap = new Map(profiles.map((p: any) => [p.id, p.display_name || 'Anonymous']));

        let receivedCompliment: string | undefined;
        if (user && chainData.current_holder === user.id && session) {
          const linksRes = await fetch(
            `${baseUrl}/rest/v1/chain_links?select=link_id,passed_to,sent_compliment,passed_at&chain_id=eq.${chainId}&order=passed_at.desc&limit=5`,
            {
              headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            }
          );
          const links = linksRes.ok ? await linksRes.json() : [];
          receivedCompliment = links[0]?.sent_compliment;
        }

        return {
          ...chainData,
          started_by_display_name: profileMap.get(chainData.started_by) || 'Anonymous',
          current_holder_display_name: uuidRegex.test(chainData.current_holder)
            ? profileMap.get(chainData.current_holder) || 'Anonymous'
            : chainData.current_holder,
          received_compliment: receivedCompliment,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') throw new Error('Request timed out');
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    },
    enabled: !!chainId,
  });

  const countdown = useCountdown(chain?.expires_at || '');

  const isCurrentHolder = user && chain?.current_holder === user.id;
  const isStarter = user && chain?.started_by === user.id;
  const isChainActive = chain?.status === 'active';

  const getTimerUrgency = () => {
    const totalMinutes = countdown.hours * 60 + countdown.minutes;
    if (totalMinutes < 10) return { color: 'text-red-500', bg: 'bg-red-500/10', animate: true, icon: '🔥' };
    if (totalMinutes < 120) return { color: 'text-orange-500', bg: 'bg-orange-500/10', animate: false, icon: '⚠️' };
    if (totalMinutes < 360) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', animate: false, icon: '⏳' };
    return { color: 'text-green-500', bg: 'bg-green-500/10', animate: false, icon: '✅' };
  };

  const urgency = getTimerUrgency();
  const tier = chain?.tier || getChainTier(chain?.share_count || 1);
  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.small;

  const handleShare = () => {
    const chainUrl = `${getShareBaseUrl()}/chain/${chainId}`;
    if (navigator.share) {
      navigator.share({
        title: `Join "${chain?.chain_name || 'Kindness Chain'}" 💚`,
        text: `I'm part of a kindness chain with ${chain?.share_count} shares!`,
        url: chainUrl,
      });
    } else {
      navigator.clipboard.writeText(chainUrl);
      toast.success('Link copied! 🔗');
    }
  };

  const handlePassSuccess = () => {
    setShowPassModal(false);
    toast.success('Chain passed! 🎉');
    navigate('/#chains');
  };

  if (isLoading) return <ChainLoadingSkeleton />;
  if (error || !chain) return <ChainNotFound onGoHome={() => navigate('/')} />;
  if (chain.status === 'broken') return <ChainBroken chain={chain} onBack={() => navigate('/#chains')} />;

  if (isCurrentHolder && isChainActive) {
    return (
      <CurrentHolderView
        chain={chain}
        countdown={countdown}
        urgency={urgency}
        tier={tier}
        config={config}
        showPassModal={showPassModal}
        setShowPassModal={setShowPassModal}
        onPassSuccess={handlePassSuccess}
      />
    );
  }

  if (isStarter && isChainActive) {
    return (
      <StarterView
        chain={chain}
        countdown={countdown}
        urgency={urgency}
        tier={tier}
        handleShare={handleShare}
        onBack={() => navigate('/#chains')}
      />
    );
  }

  // Recipient / public view — tap to reveal
  return (
    <RevealView
      chain={chain}
      countdown={countdown}
      urgency={urgency}
      tier={tier}
      user={user}
      chainId={chainId!}
      handleShare={handleShare}
      onNavigate={navigate}
      showPassModal={showPassModal}
      setShowPassModal={setShowPassModal}
      onPassSuccess={handlePassSuccess}
    />
  );
};

export default ChainPage;

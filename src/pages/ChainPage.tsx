import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, Clock, User, ArrowRight, Share2, Flame, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuth } from '@/contexts/AuthContext';
// Direct REST API fetch is used instead of supabase client to avoid deadlocks for anonymous users
import { tierConfig, getChainTier } from '@/utils/chainTiers';
import { toast } from 'sonner';
import { useState } from 'react';
import PassChainModal from '@/components/chains/PassChainModal';
import MintCircleGraphic from '@/components/chains/MintCircleGraphic';

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

const ChainPage = () => {
  const { chainId } = useParams<{ chainId: string }>();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [showPassModal, setShowPassModal] = useState(false);

  // Fetch chain data
  const { data: chain, isLoading, error } = useQuery({
    queryKey: ['chain-page', chainId],
    queryFn: async (): Promise<ChainData | null> => {
      if (!chainId) return null;
      console.log('[ChainPage] Starting chain fetch...', chainId, 'User:', user?.id || 'anonymous');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const token = session?.access_token || apiKey;

        // Fetch chain
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
        console.log('[ChainPage] Chain data received:', chainData);

        // Fetch profiles for display names
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

        // Fetch received compliment only if logged-in current holder
        let receivedCompliment: string | undefined;
        if (user && chainData.current_holder === user.id && session) {
          const linksRes = await fetch(
            `${baseUrl}/rest/v1/chain_links?select=sent_compliment&chain_id=eq.${chainId}&order=passed_at.desc&limit=1`,
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
        if (err.name === 'AbortError') {
          console.error('[ChainPage] Fetch timed out after 15s');
          throw new Error('Request timed out');
        }
        console.error('[ChainPage] Error fetching chain:', err);
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    },
    enabled: !!chainId,
  });

  const countdown = useCountdown(chain?.expires_at || '');
  
  // Determine viewer type
  const isCurrentHolder = user && chain?.current_holder === user.id;
  const isStarter = user && chain?.started_by === user.id;
  const isChainActive = chain?.status === 'active';

  // Timer urgency colors
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
    const chainUrl = `${window.location.origin}/chain/${chainId}`;
    if (navigator.share) {
      navigator.share({
        title: `Join "${chain?.chain_name || 'Kindness Chain'}" 💚`,
        text: `I'm part of a kindness chain with ${chain?.share_count} shares!`,
        url: chainUrl
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <Skeleton className="h-48 w-48 rounded-full mx-auto" />
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // Error or not found
  if (error || !chain) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Chain Not Found</h1>
          <p className="text-muted-foreground">This chain may have been broken or doesn't exist.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  // Broken chain
  if (chain.status === 'broken') {
    return (
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
          <Button onClick={() => navigate('/#chains')}>View Your Chains</Button>
        </motion.div>
      </div>
    );
  }

  // Current Holder View - Big countdown, urgent CTA
  if (isCurrentHolder && isChainActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center space-y-6"
        >
          {/* Chain Name & Tier */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl">{config.emoji}</span>
            <h1 className="text-2xl font-bold">{chain.chain_name || 'Kindness Chain'}</h1>
          </div>

          {/* Big Countdown Timer */}
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

          {/* From Who */}
          <div className="bg-muted/50 rounded-xl p-4 text-left">
            <p className="text-sm text-muted-foreground mb-1">💚 From @{chain.started_by_display_name}:</p>
            <p className="italic text-foreground">
              "{chain.received_compliment || "You're amazing and the world is better with you in it!"}"
            </p>
          </div>

          {/* Stats */}
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

          {/* Pass It Forward CTA */}
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
        </motion.div>

        {/* Pass Chain Modal */}
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
          onSuccess={handlePassSuccess}
        />
      </div>
    );
  }

  // Starter View - Track chain status
  if (isStarter && isChainActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center space-y-6"
        >
          {/* Mint Graphic */}
          <div className="w-32 h-32 mx-auto">
            <MintCircleGraphic shareCount={chain.share_count || 1} tier={tier as 'small' | 'medium' | 'large' | 'legendary'} />
          </div>

          {/* Chain Name */}
          <div>
            <h1 className="text-2xl font-bold">{chain.chain_name || 'Your Kindness Chain'}</h1>
            <p className="text-muted-foreground">Chain you started</p>
          </div>

          {/* Status Tracker */}
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

          {/* Share Button */}
          <Button 
            variant="outline"
            className="w-full rounded-full"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Chain Link
          </Button>

          <Button 
            variant="ghost"
            onClick={() => navigate('/#chains')}
          >
            ← Back to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  // Public/Participant View
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center space-y-6"
      >
        {/* Mint Graphic */}
        <div className="w-32 h-32 mx-auto">
          <MintCircleGraphic shareCount={chain.share_count || 1} tier={tier as 'small' | 'medium' | 'large' | 'legendary'} />
        </div>

        {/* Chain Info */}
        <div>
          <h1 className="text-2xl font-bold">{chain.chain_name || 'Kindness Chain'}</h1>
          <p className="text-muted-foreground">
            Started by @{chain.started_by_display_name}
          </p>
        </div>

        {/* Countdown Timer */}
        <motion.div 
          className={`${urgency.bg} rounded-2xl p-6 ${urgency.animate ? 'animate-pulse' : ''}`}
          animate={urgency.animate ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <p className="text-sm text-muted-foreground mb-2">TIME REMAINING</p>
          <p className={`text-4xl font-mono font-bold ${urgency.color}`}>
            {urgency.icon} {countdown.formattedTime}
          </p>
          {countdown.hours < 2 && (
            <p className="text-sm text-red-500 mt-2 flex items-center justify-center gap-1">
              <Flame className="h-4 w-4" />
              Don't let the chain break!
            </p>
          )}
        </motion.div>

        {/* Stats */}
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{chain.share_count}</p>
              <p className="text-xs text-muted-foreground">Shares</p>
            </div>
            <div className="text-center">
              <p className="text-2xl">{config.emoji}</p>
              <p className="text-xs text-muted-foreground capitalize">{tier}</p>
            </div>
          </div>
        </div>

        {/* Not logged in prompt */}
        {!user && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in to join this kindness chain!
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full rounded-full">
              Sign In to Participate
            </Button>
          </div>
        )}

        {/* Logged in but not holder/starter */}
        {user && !isCurrentHolder && !isStarter && (
          <Button 
            variant="outline"
            className="w-full rounded-full"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share This Chain
          </Button>
        )}

        <Button 
          variant="ghost"
          onClick={() => navigate('/')}
        >
          ← Go Home
        </Button>
      </motion.div>
    </div>
  );
};

export default ChainPage;

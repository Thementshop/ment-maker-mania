import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Check, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { usePauseTokens } from '@/hooks/usePauseTokens';
import { useGameStore } from '@/store/gameStore';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StripeCheckoutDialog } from '@/components/StripeCheckoutDialog';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import confetti from 'canvas-confetti';

interface PauseTier {
  id: 'pause_tokens_20' | 'pause_tokens_50' | 'pause_tokens_100' | 'pause_tokens_unlimited_year';
  name: string;
  qty: string;
  price: string;
  highlight?: 'best' | 'popular';
  unlimited?: boolean;
}

const pauseTiers: PauseTier[] = [
  { id: 'pause_tokens_20', name: '20 Pause Tokens', qty: '20 tokens', price: '$2.50' },
  { id: 'pause_tokens_50', name: '50 Pause Tokens', qty: '50 tokens', price: '$5.00', highlight: 'popular' },
  { id: 'pause_tokens_100', name: '100 Pause Tokens', qty: '100 tokens', price: '$7.50' },
  { id: 'pause_tokens_unlimited_year', name: '1 Year Unlimited', qty: 'Unlimited for 365 days', price: '$19.50', highlight: 'best', unlimited: true },
];

function GoldCoin({ className = '' }: { className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 shadow-[inset_0_2px_4px_rgba(255,255,255,0.5),0_4px_12px_rgba(0,0,0,0.25)] ${className}`}>
      <span className="text-yellow-900 font-black text-lg select-none">P</span>
    </div>
  );
}

function firstOfNextMonthLabel(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function isInCurrentMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

const Store = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { worldKindnessCount } = useGameStore();
  const { pauseTokens, unlimited, unlimitedExpiresAt, isLoading, refetch } = usePauseTokens();

  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [mintBoostLast, setMintBoostLast] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfileLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('mint_boost_last_purchased_at')
      .eq('id', user.id)
      .maybeSingle();
    setMintBoostLast((data?.mint_boost_last_purchased_at as string | null) ?? null);
    setProfileLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfile]);

  // Handle checkout return
  useEffect(() => {
    if (searchParams.get('checkout') !== 'success') return;
    let cancelled = false;
    const start = Date.now();
    const startSnap = { tokens: pauseTokens, mint: mintBoostLast, unlimited };

    const poll = async () => {
      while (!cancelled && Date.now() - start < 8000) {
        await refetch();
        await loadProfile();
        // crude detection: anything changed
        const { data: gs } = user
          ? await supabase.from('user_game_state').select('jar_count, pause_tokens').eq('user_id', user.id).maybeSingle()
          : { data: null as any };
        const { data: prof } = user
          ? await supabase
              .from('profiles')
              .select('mint_boost_last_purchased_at, pause_tokens_unlimited')
              .eq('id', user.id)
              .maybeSingle()
          : { data: null as any };

        const mintChanged = !!prof?.mint_boost_last_purchased_at && prof.mint_boost_last_purchased_at !== startSnap.mint;
        const unlimitedChanged = !!prof?.pause_tokens_unlimited && !startSnap.unlimited;
        const tokensChanged = (gs?.pause_tokens ?? 0) > startSnap.tokens;

        if (mintChanged) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#58fc59', '#3ed83f'] });
          toast({ title: '25 mints added to your jar! 💚' });
          break;
        }
        if (unlimitedChanged || tokensChanged) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#FFD700', '#58fc59'] });
          toast({ title: 'Your Pause Tokens have been added! 💚' });
          break;
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (!cancelled) {
        const next = new URLSearchParams(searchParams);
        next.delete('checkout');
        next.delete('session_id');
        setSearchParams(next, { replace: true });
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('checkout')]);

  const mintBlocked = isInCurrentMonth(mintBoostLast);
  const tokenDisplay = unlimited ? '∞' : isLoading ? '…' : String(pauseTokens);

  const handleBypassApplied = useCallback(async ({ priceId, quantity }: { priceId: string; quantity?: number | null }) => {
    setCheckoutPriceId(null);

    void Promise.all([refetch(), loadProfile()]).catch((error) => {
      console.error('Preview purchase refresh failed:', error);
    });

    if (priceId === 'mint_boost') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#58fc59', '#3ed83f'] });
      toast({ title: '25 mints added in preview mode! 💚' });
    } else {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#FFD700', '#58fc59'] });
      toast({
        title:
          priceId === 'pause_tokens_unlimited_year'
            ? 'Unlimited Pause Tokens enabled in preview mode! 💚'
            : `${quantity ?? ''} Pause Tokens added in preview mode! 💚`.trim(),
      });
    }
  }, [loadProfile, refetch, toast]);

  return (
    <div className="min-h-screen bg-gradient-mint flex flex-col">
      <PaymentTestModeBanner />
      <Header worldCount={worldKindnessCount} />

      <main className="container flex-1 py-8 px-4 max-w-3xl">
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center gap-3 bg-card rounded-full px-5 py-2.5 shadow-lg border border-border mb-4"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GoldCoin className="h-7 w-7" />
            <span className="text-xl font-bold text-foreground">
              You have {tokenDisplay} {unlimited ? 'Pause Tokens' : 'tokens'}
            </span>
            {unlimited && (
              <Badge className="bg-yellow-500 text-yellow-950">
                <InfinityIcon className="h-3 w-3 mr-1" /> Unlimited
              </Badge>
            )}
          </motion.div>
          {unlimited && unlimitedExpiresAt && (
            <p className="text-xs text-muted-foreground">
              Unlimited active until {unlimitedExpiresAt.toLocaleDateString()}
            </p>
          )}
        </div>

        {/* PAUSE TOKENS SECTION */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-1">Get more time with Pause Tokens</h2>
          <p className="text-sm text-muted-foreground mb-5">Reset any chain timer back to 24 hours.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pauseTiers.map((tier, idx) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className={`relative overflow-hidden ${
                    tier.highlight === 'best'
                      ? 'border-2 border-primary shadow-lg bg-gradient-to-br from-primary/5 to-yellow-100/30'
                      : tier.highlight === 'popular'
                      ? 'border-2 border-yellow-400'
                      : 'border-border'
                  }`}
                >
                  {tier.highlight === 'best' && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                      BEST VALUE
                    </div>
                  )}
                  {tier.highlight === 'popular' && (
                    <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                      POPULAR
                    </div>
                  )}
                  <CardContent className="p-5 flex items-center gap-4">
                    {tier.unlimited ? (
                      <div className="relative h-14 w-14 flex-shrink-0">
                        <GoldCoin className="h-14 w-14" />
                        <InfinityIcon className="absolute -bottom-1 -right-1 h-6 w-6 text-yellow-700 bg-yellow-100 rounded-full p-0.5" />
                      </div>
                    ) : (
                      <GoldCoin className="h-14 w-14 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground leading-tight">{tier.name}</div>
                      <div className="text-xs text-muted-foreground">{tier.qty}</div>
                      <div className="text-lg font-bold text-foreground mt-1">{tier.price}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setCheckoutPriceId(tier.id)}
                      className="flex-shrink-0"
                    >
                      Get Tokens
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* MINT BOOST SECTION */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-1">Boost your jar</h2>
          <p className="text-sm text-muted-foreground mb-5">Add mints directly to your Kindness Jar.</p>

          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-card">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex-shrink-0 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl shadow-md">
                🍬
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground leading-tight">Mint Boost — 25 Mints</div>
                <div className="text-xs text-muted-foreground">Adds 25 mints to your jar</div>
                <div className="text-lg font-bold text-foreground mt-1">$4.00</div>
              </div>
              <Button
                size="sm"
                disabled={mintBlocked || profileLoading}
                onClick={() => {
                  if (mintBlocked) {
                    toast({
                      title: "You've already boosted your jar this month!",
                      description: `Your next Mint Boost will be available on ${firstOfNextMonthLabel()}. Keep spreading kindness to earn more mints! 💚`,
                    });
                    return;
                  }
                  setCheckoutPriceId('mint_boost');
                }}
              >
                {mintBlocked ? `Available ${firstOfNextMonthLabel()}` : 'Add to your jar'}
              </Button>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2 text-center">1 Mint Boost available per month</p>
        </section>

        {/* INFO */}
        <Card className="bg-secondary/30">
          <CardContent className="py-5">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              How Pause Tokens work
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Use a token to reset a chain's countdown back to 24 hours</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>1 free token every week, automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Tokens never expire</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back
          </Button>
        </div>
      </main>

      <Footer />

      <StripeCheckoutDialog
        open={!!checkoutPriceId}
        priceId={checkoutPriceId}
        userId={user?.id}
        customerEmail={user?.email ?? undefined}
        onBypassApplied={handleBypassApplied}
        onClose={() => setCheckoutPriceId(null)}
      />
    </div>
  );
};

export default Store;

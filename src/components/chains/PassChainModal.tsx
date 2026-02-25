import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Check, Loader2, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { complimentCategories } from '@/data/compliments';
import { getChainTier } from '@/utils/chainTiers';
import confetti from 'canvas-confetti';

// Direct REST API helper - bypasses Supabase JS client deadlock
const restApi = async (
  method: 'GET' | 'POST' | 'PATCH',
  table: string,
  params: string,
  token: string,
  body?: any
): Promise<{ data: any; error: any }> => {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}?${params}`;
    const headers: Record<string, string> = {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation',
    };
    const opts: RequestInit = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    opts.signal = controller.signal;
    
    const res = await fetch(url, opts);
    clearTimeout(timeout);
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[PassChain REST] ${method} ${table} failed:`, res.status, errText);
      return { data: null, error: { message: errText, status: res.status } };
    }
    
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { data, error: null };
  } catch (err: any) {
    console.error(`[PassChain REST] ${method} ${table} exception:`, err);
    return { data: null, error: err };
  }
};

// Validation
const recipientSchema = z.string()
  .min(1, 'Please enter a recipient')
  .max(100, 'Recipient must be 100 characters or less');

interface PassChainModalProps {
  chain: {
    chain_id: string;
    chain_name: string;
    share_count: number;
    started_by: string;
    current_holder: string;
    tier: 'small' | 'medium' | 'large' | 'legendary';
  };
  receivedCompliment: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PassChainModal = ({
  chain,
  receivedCompliment,
  isOpen,
  onClose,
  onSuccess
}: PassChainModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'choice' | 'forward' | 'choose'>('choice');
  const [recipient, setRecipient] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCompliment, setSelectedCompliment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setRecipient('');
      setSelectedCategory('');
      setSelectedCompliment('');
      setError('');
    }
  }, [isOpen]);

  // Debug logging: track compliment source for this modal instance
  useEffect(() => {
    if (!isOpen) return;

    const debugTimestamp = new Date().toISOString();
    console.groupCollapsed(`[PassChainModal][Debug] Opened for chain ${chain.chain_id}`);
    console.log('openedAt', debugTimestamp);
    console.log('chain_id', chain.chain_id);
    console.log('receivedCompliment prop', receivedCompliment);
    console.log('current user', { id: user?.id, email: user?.email });
    console.log('chain snapshot', chain);
    console.groupEnd();

    const logChainLinkDebug = async () => {
      const { data, error } = await supabase
        .from('chain_links')
        .select('link_id, chain_id, passed_to, sent_compliment, received_compliment, passed_at')
        .eq('chain_id', chain.chain_id)
        .order('passed_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('[PassChainModal][Debug] chain_links query error:', error);
        return;
      }

      const latest = data?.[0];
      const hasMatchForUser = (data || []).some((link) => {
        const matchesId = !!user?.id && link.passed_to === user.id;
        const matchesEmail = !!user?.email && link.passed_to.toLowerCase() === user.email.toLowerCase();
        return matchesId || matchesEmail;
      });

      console.groupCollapsed(`[PassChainModal][Debug] chain_links query result for ${chain.chain_id}`);
      console.log('rows', data || []);
      console.log('latest link used by DB sort', latest ? {
        chain_link_id: latest.link_id,
        passed_to: latest.passed_to,
        sent_compliment: latest.sent_compliment,
        received_compliment: latest.received_compliment,
        passed_at: latest.passed_at,
      } : null);
      console.log('comparison', {
        prop_receivedCompliment: receivedCompliment,
        latest_db_sent_compliment: latest?.sent_compliment ?? null,
        has_match_for_user: hasMatchForUser,
      });
      console.groupEnd();
    };

    void logChainLinkDebug();
  }, [isOpen, chain.chain_id, receivedCompliment, user?.id, user?.email]);

  const getComplimentsForCategory = () => {
    const category = complimentCategories.find(c => c.id === selectedCategory);
    return category?.compliments || [];
  };

  const handleClose = () => {
    setStep('choice');
    setRecipient('');
    setSelectedCategory('');
    setSelectedCompliment('');
    setError('');
    onClose();
  };

  const handleForwardSelect = () => {
    setSelectedCompliment(receivedCompliment);
    setStep('forward');
  };

  const handleChooseSelect = () => {
    setStep('choose');
  };

  const handleComplimentSelect = (compliment: string) => {
    setSelectedCompliment(compliment);
  };

  // Promote next queued chain (REST API)
  const promoteNextQueuedChain = async (userId: string, token: string) => {
    try {
      const { data: yourTurnChains } = await restApi(
        'GET', 'ment_chains',
        `select=chain_id&current_holder=eq.${userId}&status=eq.active&is_queued=eq.false`,
        token
      );

      if (yourTurnChains && yourTurnChains.length < 3) {
        const { data: queuedChains } = await restApi(
          'GET', 'ment_chains',
          `select=*&current_holder=eq.${userId}&is_queued=eq.true&order=created_at.asc&limit=1`,
          token
        );

        if (queuedChains && queuedChains.length > 0) {
          await restApi(
            'PATCH', 'ment_chains',
            `chain_id=eq.${queuedChains[0].chain_id}`,
            token,
            { is_queued: false }
          );

          toast({
            title: "Queue Update 🔗",
            description: "A queued chain is now active!"
          });
        }
      }
    } catch (err) {
      console.error('Error promoting queued chain:', err);
    }
  };

  // Legendary celebration
  const triggerLegendaryCelebration = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FFA500', '#FF6347']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#FFA500', '#FF6347']
      });
    }, 250);
  };

  const handlePassChain = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to pass a chain",
        variant: "destructive"
      });
      return;
    }

    // Validate recipient
    const result = recipientSchema.safeParse(recipient.trim());
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get session token for REST calls
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No auth session');

      console.log('[PassChain] Starting pass via REST API for chain:', chain.chain_id);

      // 1. Get chain participants (check for duplicates)
      const { data: chainLinks, error: linksErr } = await restApi(
        'GET', 'chain_links',
        `select=passed_to,passed_by&chain_id=eq.${chain.chain_id}`,
        token
      );

      if (linksErr) {
        console.error('[PassChain] Failed to fetch chain links:', linksErr);
        // Non-fatal, continue without duplicate check
      }

      const participants = new Set<string>();
      (chainLinks || []).forEach((link: any) => {
        participants.add(link.passed_to);
        participants.add(link.passed_by);
      });

      // 2. Check if recipient already in chain
      if (participants.has(recipient.trim())) {
        toast({
          title: "⚠️ Already in this chain!",
          description: `${recipient} is already part of this chain. Choose someone new to spread the kindness further.`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // 3. Check recipient capacity (max 3 "Your Turn" chains)
      const { data: recipientChains } = await restApi(
        'GET', 'ment_chains',
        `select=chain_id&current_holder=eq.${encodeURIComponent(recipient.trim())}&status=eq.active&is_queued=eq.false`,
        token
      );

      if (recipientChains && recipientChains.length >= 3) {
        toast({
          title: "Recipient at capacity",
          description: `${recipient} has 3 active chains and can't receive more right now. Try someone else! 💚`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // 4. Update chain
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const newShareCount = chain.share_count + 1;
      const newTier = getChainTier(newShareCount);

      console.log('[PassChain] Updating chain:', { newShareCount, newTier });

      const { error: updateError } = await restApi(
        'PATCH', 'ment_chains',
        `chain_id=eq.${chain.chain_id}`,
        token,
        {
          current_holder: recipient.trim(),
          expires_at: newExpiresAt.toISOString(),
          share_count: newShareCount,
          tier: newTier,
          links_count: newShareCount
        }
      );

      if (updateError) throw new Error(`Chain update failed: ${updateError.message}`);

      // 5. Create link record
      console.log('[PassChain] Inserting chain link');
      const { error: linkError } = await restApi(
        'POST', 'chain_links',
        '',
        token,
        {
          chain_id: chain.chain_id,
          passed_by: user.id,
          passed_to: recipient.trim(),
          received_compliment: receivedCompliment,
          sent_compliment: selectedCompliment,
          was_forwarded: selectedCompliment === receivedCompliment
        }
      );

      if (linkError) throw new Error(`Link insert failed: ${linkError.message}`);

      // 6. Update user's "your turn" count
      const { data: userStates } = await restApi(
        'GET', 'user_game_state',
        `select=your_turn_chains_count&user_id=eq.${user.id}`,
        token
      );

      const userState = userStates?.[0];
      if (userState) {
        await restApi(
          'PATCH', 'user_game_state',
          `user_id=eq.${user.id}`,
          token,
          {
            your_turn_chains_count: Math.max(0, (userState.your_turn_chains_count || 0) - 1)
          }
        );
      }

      // 7. Check for Legendary milestone (100 shares)
      if (newShareCount === 100 && chain.started_by === user.id) {
        triggerLegendaryCelebration();
      } else {
        // Regular confetti
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#2ECC71', '#27AE60', '#F1C40F']
        });
      }

      // 8. Auto-promote queued chain
      await promoteNextQueuedChain(user.id, token);

      // 9. Success!
      console.log('[PassChain] ✅ Chain passed successfully!');
      toast({
        title: "Chain passed! 🔗",
        description: "+1 mint added to your jar 🍬"
      });

      onSuccess();
      handleClose();

    } catch (err) {
      console.error('[PassChain] Error passing chain:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to pass chain. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Pass the Ment 🔗
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Step 1: Choice */}
          {step === 'choice' && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <p className="text-center text-muted-foreground">
                How would you like to pass this chain?
              </p>

              {/* Option 1: Forward same compliment */}
              <button
                onClick={handleForwardSelect}
                className="w-full p-4 rounded-2xl border-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all text-left"
              >
                <p className="font-semibold text-foreground">Share this Ment</p>
                <p className="text-sm text-muted-foreground">Keep the vibe going 🔗</p>
                <p className="text-sm text-primary mt-2 italic line-clamp-2">
                  "{receivedCompliment}"
                </p>
              </button>

              {/* Option 2: Choose new */}
              <button
                onClick={handleChooseSelect}
                className="w-full p-4 rounded-2xl border-2 border-primary bg-primary hover:bg-primary/90 transition-all text-left text-primary-foreground"
              >
                <p className="font-semibold">Choose your own</p>
                <p className="text-sm opacity-90">Make it personal 💚</p>
              </button>

              <Button
                variant="ghost"
                onClick={handleClose}
                className="w-full"
              >
                Cancel
              </Button>
            </motion.div>
          )}

          {/* Step 2A: Forward Flow */}
          {step === 'forward' && (
            <motion.div
              key="forward"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-center">Send To</h3>

              <Input
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value.slice(0, 100));
                  setError('');
                }}
                placeholder="Name, email, or phone number"
                maxLength={100}
                autoFocus
              />

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              {/* Preview */}
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <p className="text-sm font-medium text-muted-foreground">You're sharing:</p>
                <p className="text-sm text-primary mt-1 italic">"{selectedCompliment}"</p>
              </div>

              <Button
                onClick={handlePassChain}
                disabled={loading || !recipient.trim()}
                className="w-full rounded-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send →'
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setStep('choice')}
                disabled={loading}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </motion.div>
          )}

          {/* Step 2B: Choose New Flow */}
          {step === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-center">Choose Your Compliment</h3>

              {/* Category selection */}
              <div className="grid grid-cols-3 gap-2">
                {complimentCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      selectedCategory === cat.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="text-xl block">{cat.emoji}</span>
                    <span className="text-xs font-medium">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Compliment list */}
              {selectedCategory && (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 pr-2">
                    {getComplimentsForCategory().map((compliment, index) => (
                      <button
                        key={index}
                        onClick={() => handleComplimentSelect(compliment)}
                        className={`w-full p-3 rounded-xl border-2 transition-all text-left text-sm ${
                          selectedCompliment === compliment
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        {compliment}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Recipient input (after compliment selected) */}
              {selectedCompliment && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <Input
                    value={recipient}
                    onChange={(e) => {
                      setRecipient(e.target.value.slice(0, 100));
                      setError('');
                    }}
                    placeholder="Send to (name, email, or phone)"
                    maxLength={100}
                  />

                  {error && (
                    <p className="text-sm text-destructive text-center">{error}</p>
                  )}

                  <Button
                    onClick={handlePassChain}
                    disabled={loading || !recipient.trim()}
                    className="w-full rounded-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send →'
                    )}
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedCategory('');
                  setSelectedCompliment('');
                  setStep('choice');
                }}
                disabled={loading}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default PassChainModal;

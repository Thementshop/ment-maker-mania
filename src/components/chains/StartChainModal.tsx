import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, ArrowLeft, Send, Check, User, Mail, Phone, Sparkles, Flame, Loader2 } from 'lucide-react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { complimentCategories, type ComplimentCategory } from '@/data/compliments';
import { getAvailableChainNames, isChainNameAvailable } from '@/utils/chainNames';
import confetti from 'canvas-confetti';

interface StartChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type RecipientType = 'contact' | 'email' | 'phone';

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address').max(255);
const phoneSchema = z.string().min(10, 'Please enter a valid phone number').max(20);
const contactSchema = z.string().min(1, 'Please enter a name').max(100);
const chainNameSchema = z.string().max(50, 'Chain name must be 50 characters or less').optional();

const StartChainModal = ({ isOpen, onClose, onSuccess }: StartChainModalProps) => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  
  // Step management
  const [step, setStep] = useState<'name' | 'recipient' | 'category' | 'compliment' | 'sending' | 'success'>('name');
  
  // Chain name state
  const [chainName, setChainName] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Recipient state
  const [recipientType, setRecipientType] = useState<RecipientType>('contact');
  const [recipientValue, setRecipientValue] = useState('');
  const [recipientError, setRecipientError] = useState('');
  
  // Compliment state
  const [selectedCategory, setSelectedCategory] = useState<ComplimentCategory | null>(null);
  const [selectedCompliment, setSelectedCompliment] = useState('');

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

  // Load suggestions when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen]);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const names = await getAvailableChainNames();
      setNameSuggestions(names);
    } catch (err) {
      console.error('Error loading suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };
  
  const resetModal = useCallback(() => {
    setStep('name');
    setChainName('');
    setRecipientType('contact');
    setRecipientValue('');
    setRecipientError('');
    setSelectedCategory(null);
    setSelectedCompliment('');
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Helper for query timeouts with fallbacks
  const queryWithTimeout = async <T,>(
    promise: PromiseLike<{ data: T; error: any }>,
    timeoutMs: number,
    fallbackData: T,
    label: string
  ): Promise<{ data: T; error: any }> => {
    const timeoutPromise = new Promise<{ data: T; error: any }>((resolve) => 
      setTimeout(() => {
        console.warn(`${label} timed out after ${timeoutMs}ms, using fallback`);
        resolve({ data: fallbackData, error: null });
      }, timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
  };

  // Helper for critical queries that must succeed (throws on timeout)
  const criticalQueryWithTimeout = async <T,>(
    promise: PromiseLike<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`${label} timed out - database may be slow`)), timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
  };

  // Lenient validation for testing
  const validateRecipient = (): boolean => {
    if (recipientType === 'email') {
      if (!recipientValue.includes('@')) {
        setRecipientError('Enter an email (e.g., test@example.com)');
        return false;
      }
    } else if (recipientType === 'phone') {
      if (recipientValue.length < 3) {
        setRecipientError('Enter a phone number');
        return false;
      }
    } else {
      if (recipientValue.length < 1) {
        setRecipientError('Enter a name');
        return false;
      }
    }
    setRecipientError('');
    return true;
  };

  const handleNameNext = () => {
    setStep('recipient');
  };

  const handleRecipientNext = () => {
    if (!validateRecipient()) return;
    setStep('category');
  };

  const handleCategorySelect = (category: ComplimentCategory) => {
    setSelectedCategory(category);
    setStep('compliment');
  };

  const handleComplimentSelect = (compliment: string) => {
    setSelectedCompliment(compliment);
    handleSend(compliment);
  };

  const handleSend = async (compliment: string) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to start a chain",
        variant: "destructive"
      });
      return;
    }

    setStep('sending');

    // === AUTH DEBUG START ===
    console.log('=== AUTH DEBUG ===');
    console.log('user object:', user);
    console.log('user.id:', user?.id);
    console.log('profile:', profile);
    console.log('Auth status:', user ? 'AUTHENTICATED' : 'NOT AUTHENTICATED');

    if (!user?.id) {
      toast({
        title: "Not authenticated",
        description: "Your session may have expired. Please refresh and try again.",
        variant: "destructive"
      });
      setStep('name');
      return;
    }
    // === AUTH DEBUG END ===
    
    // Global timeout for entire chain creation (25s to accommodate cold starts)
    const timeoutId = setTimeout(() => {
      toast({
        title: "Taking too long",
        description: "Chain creation timed out. Please try again.",
        variant: "destructive"
      });
      setStep('name');
    }, 25000);
    
    try {
      // 1. Check daily limit (with 5s timeout, fallback allows creation)
      console.log('Step 1: Checking daily limit...');
      const { data: gameState } = await queryWithTimeout(
        supabase
          .from('user_game_state')
          .select('chains_started_today, last_chain_start_date')
          .eq('user_id', user.id)
          .maybeSingle(),
        5000,
        { chains_started_today: 0, last_chain_start_date: null },
        'Daily limit check'
      );
      console.log('Step 1 complete:', gameState);

      const lastStart = new Date(gameState?.last_chain_start_date || 0);
      const now = new Date();
      const isNewDay = now.getUTCDate() !== lastStart.getUTCDate() ||
                       now.getUTCMonth() !== lastStart.getUTCMonth() ||
                       now.getUTCFullYear() !== lastStart.getUTCFullYear();

      if (!isNewDay && (gameState?.chains_started_today || 0) >= 1) {
        clearTimeout(timeoutId);
        toast({
          title: "Daily limit reached",
          description: "You've started your daily chain. Try again tomorrow!",
          variant: "destructive"
        });
        setStep('name');
        return;
      }

      // 2. Finalize chain name
      const finalName = chainName.trim() || `@${displayName}'s Chain`;
      console.log('Step 2: Using chain name:', finalName);

      // 3. Check name availability if custom (with 3s timeout, fallback assumes available)
      if (chainName.trim()) {
        console.log('Step 3: Checking name availability...');
        const { data: isAvailable } = await queryWithTimeout(
          (async () => {
            const available = await isChainNameAvailable(chainName.trim());
            return { data: available, error: null };
          })(),
          3000,
          true,
          'Name availability check'
        );
        console.log('Step 3 complete, available:', isAvailable);
        if (!isAvailable) {
          clearTimeout(timeoutId);
          toast({
            title: "Name taken",
            description: "That chain name is already in use. Choose another!",
            variant: "destructive"
          });
          setStep('name');
          return;
        }
      }

      // 4. Create chain (with 15s timeout to accommodate cold starts)
      console.log('Step 4: Creating chain...');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Log exact values being sent
      const chainPayload = {
        chain_name: finalName,
        started_by: user.id,
        current_holder: recipientValue.trim(),
        expires_at: expiresAt.toISOString(),
        status: 'active',
        share_count: 1,
        tier: 'small',
        links_count: 1
      };
      console.log('Step 4: Payload being sent:', chainPayload);
      console.log('Step 4: user.id type:', typeof user.id);
      console.log('Step 4: user.id value:', user.id);
      console.log('Step 4: Request starting at:', new Date().toISOString());

      const { data: newChain, error: chainError } = await criticalQueryWithTimeout(
        supabase
          .from('ment_chains')
          .insert(chainPayload)
          .select()
          .single(),
        15000,
        'Chain creation'
      );
      console.log('Step 4: Response received at:', new Date().toISOString());

      if (chainError) {
        console.error('Chain creation error:', chainError);
        throw new Error(`Failed to create chain: ${chainError.message}`);
      }
      console.log('Step 4 complete, chain created:', newChain.chain_id);

      // 5. Claim chain name if custom (fire-and-forget, non-blocking)
      if (chainName.trim() && newChain) {
        console.log('Step 5: Claiming chain name (fire-and-forget)...');
        supabase
          .from('used_chain_names')
          .insert({
            chain_name: finalName,
            chain_id: newChain.chain_id
          })
          .then(({ error }) => {
            if (error) console.warn('Name claim failed (non-critical):', error);
            else console.log('Step 5 complete: Name claimed');
          });
      }

      // 6. Create first link (with 15s timeout to accommodate cold starts)
      console.log('Step 6: Creating first chain link...');
      const { error: linkError } = await criticalQueryWithTimeout(
        supabase
          .from('chain_links')
          .insert({
            chain_id: newChain.chain_id,
            passed_by: user.id,
            passed_to: recipientValue.trim(),
            received_compliment: '',
            sent_compliment: compliment,
            was_forwarded: false
          }),
        15000,
        'Link creation'
      );

      if (linkError) {
        console.error('Link creation error:', linkError);
        throw new Error(`Failed to create link: ${linkError.message}`);
      }
      console.log('Step 6 complete');

      // 7. Update user stats (fire-and-forget, non-blocking)
      console.log('Step 7: Updating user stats (fire-and-forget)...');
      supabase
        .from('user_game_state')
        .update({
          chains_started_today: isNewDay ? 1 : (gameState?.chains_started_today || 0) + 1,
          last_chain_start_date: now.toISOString()
        })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.warn('Stats update failed (non-critical):', error);
          else console.log('Step 7 complete: Stats updated');
        });

      // 8. Success!
      clearTimeout(timeoutId);
      setStep('success');
      
      toast({
        title: "Chain Started! 🔥",
        description: `Your chain "${finalName}" has been created!`,
      });
      
      // Fire confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6B35', '#F7931E', '#FFD23F', '#2ECC71']
      });

      // Auto close after success
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2500);

    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Chain creation failed:', error);
      
      const message = error?.message?.includes('timed out')
        ? 'Database is slow right now. Please try again.'
        : error?.message || 'Something went wrong. Please try again.';
        
      toast({
        title: "Couldn't start chain",
        description: message,
        variant: "destructive"
      });
      setStep('name');
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'recipient':
        setStep('name');
        break;
      case 'category':
        setStep('recipient');
        break;
      case 'compliment':
        setStep('category');
        break;
      default:
        break;
    }
  };

  const renderNameStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Link2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Name Your Chain</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Give your chain a memorable name
        </p>
      </div>

      <div className="space-y-2">
        <Input
          value={chainName}
          onChange={(e) => setChainName(e.target.value.slice(0, 50))}
          placeholder="Give your chain a name (optional)"
          maxLength={50}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground text-right">{chainName.length}/50</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Suggestions:</p>
        <div className="flex flex-wrap gap-2">
          {loadingSuggestions ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            nameSuggestions.map((name) => (
              <button
                key={name}
                onClick={() => setChainName(name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  chainName === name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {name}
              </button>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Leave blank to use: "@{displayName}'s Chain"
      </p>

      <Button onClick={handleNameNext} className="w-full" size="lg">
        Next →
      </Button>
    </motion.div>
  );

  const renderRecipientStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 mb-4">
          <Flame className="h-8 w-8 text-orange-500" />
        </div>
        <h3 className="text-lg font-semibold">Who's first?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Who will you send the first ment to?
        </p>
      </div>

      {/* Recipient Type Tabs */}
      <div className="flex gap-2">
        {[
          { type: 'contact' as RecipientType, icon: User, label: 'Name' },
          { type: 'email' as RecipientType, icon: Mail, label: 'Email' },
          { type: 'phone' as RecipientType, icon: Phone, label: 'Phone' },
        ].map(({ type, icon: Icon, label }) => (
          <Button
            key={type}
            variant={recipientType === type ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setRecipientType(type);
              setRecipientValue('');
              setRecipientError('');
            }}
          >
            <Icon className="h-4 w-4 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {/* Recipient Input */}
      <div className="space-y-2">
        <Label htmlFor="recipient">
          {recipientType === 'contact' && 'Contact Name'}
          {recipientType === 'email' && 'Email Address'}
          {recipientType === 'phone' && 'Phone Number'}
        </Label>
        <Input
          id="recipient"
          type={recipientType === 'email' ? 'email' : recipientType === 'phone' ? 'tel' : 'text'}
          placeholder={
            recipientType === 'contact' ? 'Enter name...' :
            recipientType === 'email' ? 'friend@example.com' :
            '(555) 123-4567'
          }
          value={recipientValue}
          onChange={(e) => {
            setRecipientValue(e.target.value);
            setRecipientError('');
          }}
          className={recipientError ? 'border-destructive' : ''}
        />
        {recipientError && (
          <p className="text-xs text-destructive">{recipientError}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={handleBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleRecipientNext} className="flex-1" size="lg" disabled={!recipientValue.trim()}>
          Choose Ment
        </Button>
      </div>
    </motion.div>
  );

  const renderCategoryStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold">Pick a Category</h3>
        <p className="text-sm text-muted-foreground mt-1">
          What kind of ment will start this chain?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {complimentCategories.map((category) => (
          <motion.button
            key={category.id}
            onClick={() => handleCategorySelect(category)}
            className="p-4 rounded-xl border-2 border-border hover:border-primary bg-card hover:bg-primary/5 transition-all text-left"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-2xl mb-2 block">{category.emoji}</span>
            <span className="font-semibold text-sm">{category.name}</span>
          </motion.button>
        ))}
      </div>

      <Button variant="outline" onClick={handleBack} className="w-full">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
    </motion.div>
  );

  const renderComplimentStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="text-center mb-2">
        <span className="text-2xl">{selectedCategory?.emoji}</span>
        <h3 className="text-lg font-semibold mt-1">{selectedCategory?.name}</h3>
        <p className="text-sm text-muted-foreground">
          Pick the ment to start the chain
        </p>
      </div>

      <ScrollArea className="h-[300px] pr-2">
        <div className="space-y-2">
          {selectedCategory?.compliments.map((compliment, index) => (
            <motion.button
              key={index}
              onClick={() => handleComplimentSelect(compliment)}
              className="w-full p-3 rounded-xl border border-border hover:border-primary bg-card hover:bg-primary/5 transition-all text-left text-sm"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              {compliment}
            </motion.button>
          ))}
        </div>
      </ScrollArea>

      <Button variant="outline" onClick={handleBack} className="w-full">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
    </motion.div>
  );

  const renderSendingStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <motion.div
        className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
      >
        <Send className="h-10 w-10 text-orange-500" />
      </motion.div>
      <p className="mt-4 text-lg font-semibold">Starting your chain...</p>
      <p className="text-sm text-muted-foreground">Igniting the spark ✨</p>
    </motion.div>
  );

  const renderSuccessStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center mb-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      >
        <Check className="h-10 w-10 text-white" />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-xl font-bold text-foreground mb-2">Chain Started! 🔥</h3>
        <p className="text-muted-foreground">
          "{chainName || `@${displayName}'s Chain`}" is on its way!
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-orange-500">
          <Sparkles className="h-5 w-5" />
          <span className="font-semibold">24h Timer Started</span>
          <Sparkles className="h-5 w-5" />
        </div>
      </motion.div>
    </motion.div>
  );

  // Progress indicator
  const getStepNumber = () => {
    switch (step) {
      case 'name': return 1;
      case 'recipient': return 2;
      case 'category': return 3;
      case 'compliment': return 4;
      default: return 4;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Start a Chain
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        {step !== 'sending' && step !== 'success' && (
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-all ${
                  s === getStepNumber() ? 'w-6 bg-primary' : s < getStepNumber() ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'name' && renderNameStep()}
          {step === 'recipient' && renderRecipientStep()}
          {step === 'category' && renderCategoryStep()}
          {step === 'compliment' && renderComplimentStep()}
          {step === 'sending' && renderSendingStep()}
          {step === 'success' && renderSuccessStep()}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default StartChainModal;

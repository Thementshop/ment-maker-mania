import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, ArrowLeft, Send, Check, User, Mail, Phone, Sparkles, Flame, Loader2 } from 'lucide-react';
import SavedContactsDropdown from '@/components/SavedContactsDropdown';
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
import CustomComplimentInput from '@/components/CustomComplimentInput';
import { getAvailableChainNames } from '@/utils/chainNames';
import confetti from 'canvas-confetti';

interface StartChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type RecipientType = 'contact' | 'email' | 'phone';

const StartChainModal = ({ isOpen, onClose, onSuccess }: StartChainModalProps) => {
  const { toast } = useToast();
  const { user, profile, session } = useAuth();
  
  const [step, setStep] = useState<'name' | 'recipient' | 'pickCompliment' | 'sending' | 'success'>('name');
  
  // Chain name state
  const [chainName, setChainName] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Multi-recipient state
  const [recipientType, setRecipientType] = useState<RecipientType>('contact');
  const [recipients, setRecipients] = useState<string[]>(['', '', '']);
  const [recipientErrors, setRecipientErrors] = useState<string[]>(['', '', '']);
  
  // Per-recipient compliment state
  const [activeIndex, setActiveIndex] = useState(0); // which recipient we're currently picking for
  const [compliments, setCompliments] = useState<string[]>(['', '', '']);
  const [activeCategory, setActiveCategory] = useState<ComplimentCategory | null>(null);
  // legacy single-compliment state (kept for compatibility but unused in flow)
  const [selectedCategory, setSelectedCategory] = useState<ComplimentCategory | null>(null);
  const [selectedCompliment, setSelectedCompliment] = useState('');

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

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
    setRecipients(['', '', '']);
    setRecipientErrors(['', '', '']);
    setActiveIndex(0);
    setCompliments(['', '', '']);
    setActiveCategory(null);
    setSelectedCategory(null);
    setSelectedCompliment('');
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const validateRecipient = (value: string, index: number): string => {
    // Only first recipient is required
    if (!value.trim()) {
      return index === 0 ? 'Please enter a value' : '';
    }
    if (recipientType === 'email') {
      if (!value.includes('@')) return 'Enter a valid email';
    } else if (recipientType === 'phone') {
      if (value.length < 3) return 'Enter a valid phone number';
    } else {
      if (value.length < 1) return 'Enter a name';
    }
    return '';
  };

  const validateAllRecipients = (): boolean => {
    const errors = recipients.map((r, i) => validateRecipient(r, i));
    
    // Check for duplicates among non-empty values
    const trimmed = recipients.map(r => r.trim().toLowerCase());
    trimmed.forEach((val, i) => {
      if (val && trimmed.indexOf(val) !== i) {
        errors[i] = 'Duplicate recipient';
      }
    });

    // Check if sending to self
    const userEmail = user?.email?.toLowerCase();
    if (userEmail) {
      trimmed.forEach((val, i) => {
        if (val === userEmail) {
          errors[i] = "You can't send to yourself";
        }
      });
    }
    
    setRecipientErrors(errors);
    return errors.every(e => !e);
  };

  const updateRecipient = (index: number, value: string) => {
    const updated = [...recipients];
    updated[index] = value;
    setRecipients(updated);
    const errs = [...recipientErrors];
    errs[index] = '';
    setRecipientErrors(errs);
  };

  const handleNameNext = () => {
    setStep('recipient');
  };

  const validRecipients = () => recipients.map(r => r.trim()).filter(Boolean);

  const handleRecipientNext = () => {
    if (!validateAllRecipients()) return;
    setActiveIndex(0);
    setActiveCategory(null);
    setStep('pickCompliment');
  };

  const handleComplimentChosen = (compliment: string) => {
    const valid = validRecipients();
    const updated = [...compliments];
    updated[activeIndex] = compliment;
    setCompliments(updated);

    const nextIndex = activeIndex + 1;
    if (nextIndex < valid.length) {
      setActiveIndex(nextIndex);
      setActiveCategory(null);
    } else {
      // Done — fire send with first compliment as the "primary"
      handleSend(updated[0], updated.slice(0, valid.length));
    }
  };

  const handleSend = async (compliment: string, perRecipient?: string[]) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to start a chain",
        variant: "destructive"
      });
      return;
    }

    setStep('sending');

    const finalName = chainName.trim() || `@${displayName}'s Chain`;
    const validRecipients = recipients.map(r => r.trim()).filter(Boolean);
    const perComplimentList = perRecipient && perRecipient.length === validRecipients.length
      ? perRecipient
      : validRecipients.map(() => compliment);

    try {
      let accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error('Please log in again to start a chain.');
      }
      
      // Check if token is expired
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        if (Date.now() > expiresAt - 30000) {
          const refreshToken = session?.refresh_token;
          if (refreshToken) {
            const refreshResp = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
              }
            );
            if (refreshResp.ok) {
              const refreshData = await refreshResp.json();
              accessToken = refreshData.access_token;
            } else {
              throw new Error('Session expired. Please log in again.');
            }
          } else {
            throw new Error('Session expired. Please log in again.');
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('Session expired')) throw e;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-chain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            chainName: finalName,
            recipients: validRecipients,
            compliment: compliment,
            compliments: perComplimentList,
            complimentCategory: activeCategory?.id || selectedCategory?.id || null,
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create chain');
      }

      if (!result.chain) {
        throw new Error('No chain returned from server');
      }

      setStep('success');
      
      const recipientCount = validRecipients.length;
      toast({
        title: "Chain Started! 🔥 +5 mints! 🎨",
        description: `Your chain "${finalName}" has been sent to ${recipientCount} ${recipientCount === 1 ? 'person' : 'people'}! 5 mints added to your jar.`,
      });

      const { useGameStore } = await import('@/store/gameStore');
      const state = useGameStore.getState();
      useGameStore.setState({ 
        jarCount: typeof result.newJarCount === 'number' ? result.newJarCount : state.jarCount + 5,
        totalSent: typeof result.newTotalSent === 'number' ? result.newTotalSent : state.totalSent + 1,
      });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6B35', '#F7931E', '#FFD23F', '#58fc59']
      });

      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2500);

    } catch (error: any) {
      let message = 'Something went wrong. Please try again.';
      if (error.name === 'AbortError') {
        message = 'Request timed out. Please try again.';
      } else if (error.message) {
        message = error.message;
      }
        
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
      case 'recipient': setStep('name'); break;
      case 'pickCompliment':
        if (activeCategory) {
          setActiveCategory(null);
        } else if (activeIndex > 0) {
          setActiveIndex(activeIndex - 1);
          setActiveCategory(null);
        } else {
          setStep('recipient');
        }
        break;
      default: break;
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
          Send to up to 3 people to boost chain survival! 🚀
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
              setRecipients(['', '', '']);
              setRecipientErrors(['', '', '']);
            }}
          >
            <Icon className="h-4 w-4 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {/* All 3 recipient inputs shown upfront */}
      <div className="space-y-3">
        <Label>
          Send to (up to 3 people):
        </Label>
        
        {recipients.map((recipient, index) => (
          <div key={index} className="space-y-1">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium text-muted-foreground w-5 shrink-0">{index + 1}.</span>
              {recipientType === 'email' ? (
                <SavedContactsDropdown
                  value={recipient}
                  onChange={(val) => updateRecipient(index, val)}
                  onSelect={(email) => updateRecipient(index, email)}
                  placeholder="person@example.com"
                  className={recipientErrors[index] ? 'border-destructive' : ''}
                />
              ) : (
                <Input
                  type={recipientType === 'phone' ? 'tel' : 'text'}
                  placeholder={
                    recipientType === 'contact' ? `Person's name` :
                    '(555) 123-4567'
                  }
                  value={recipient}
                  onChange={(e) => updateRecipient(index, e.target.value)}
                  className={recipientErrors[index] ? 'border-destructive' : ''}
                />
              )}
              {index > 0 && (
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
              )}
            </div>
            {recipientErrors[index] ? (
              <p className="text-xs text-destructive ml-7">{recipientErrors[index]}</p>
            ) : (
              <p className="text-xs text-muted-foreground ml-7">
                {index === 0 ? '(required)' : '(optional — boosts chain survival!)'}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
        <Sparkles className="h-4 w-4" />
        Earn 5 mints for starting!
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={handleBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleRecipientNext} 
          className="flex-1" 
          size="lg" 
          disabled={!recipients.some(r => r.trim())}
        >
          Choose Ment
        </Button>
      </div>
    </motion.div>
  );

  const renderPickComplimentStep = () => {
    const valid = validRecipients();
    const recipientLabel = valid[activeIndex] || `Recipient ${activeIndex + 1}`;
    const previousLabel = activeIndex > 0 ? (valid[activeIndex - 1] || `Recipient ${activeIndex}`) : '';
    const previousCompliment = activeIndex > 0 ? compliments[activeIndex - 1] : '';

    return (
      <motion.div
        key={`pick-${activeIndex}-${activeCategory?.id || 'cats'}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-4"
      >
        <div className="text-center mb-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Ment {activeIndex + 1} of {valid.length}
          </p>
          <h3 className="text-lg font-semibold mt-1">For {recipientLabel}</h3>
        </div>

        {/* "Same as previous" big quick action */}
        {activeIndex > 0 && previousCompliment && !activeCategory && (
          <button
            onClick={() => handleComplimentChosen(previousCompliment)}
            className="w-full p-4 rounded-2xl border-2 border-primary bg-primary/10 hover:bg-primary/15 transition-all text-left"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Check className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {activeIndex === 1
                    ? `Same compliment as ${previousLabel}?`
                    : 'Same compliment as above?'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                  "{previousCompliment}"
                </p>
                <p className="text-xs text-primary font-medium mt-1">Tap to use this →</p>
              </div>
            </div>
          </button>
        )}

        {!activeCategory ? (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {activeIndex > 0 ? 'Or pick something different' : 'Pick a category'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {complimentCategories.map((category) => (
                <motion.button
                  key={category.id}
                  onClick={() => setActiveCategory(category)}
                  className="p-4 rounded-xl border-2 border-border hover:border-primary bg-card hover:bg-primary/5 transition-all text-left"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-2xl mb-2 block">{category.emoji}</span>
                  <span className="font-semibold text-sm">{category.name}</span>
                </motion.button>
              ))}
            </div>
            <CustomComplimentInput onSelect={(text) => handleComplimentChosen(text)} />
          </>
        ) : (
          <>
            <div className="text-center mb-1">
              <span className="text-2xl">{activeCategory.emoji}</span>
              <h4 className="text-base font-semibold mt-1">{activeCategory.name}</h4>
            </div>
            <ScrollArea className="h-[260px] pr-2">
              <div className="space-y-2">
                {activeCategory.compliments.map((compliment, index) => (
                  <motion.button
                    key={index}
                    onClick={() => handleComplimentChosen(compliment)}
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
          </>
        )}

        <Button variant="outline" onClick={handleBack} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </motion.div>
    );
  };

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

  const renderSuccessStep = () => {
    const recipientCount = recipients.filter(r => r.trim()).length;
    return (
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
            "{chainName || `@${displayName}'s Chain`}" sent to {recipientCount} {recipientCount === 1 ? 'person' : 'people'}!
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-orange-500">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold">24h Timer Started</span>
            <Sparkles className="h-5 w-5" />
          </div>
        </motion.div>
      </motion.div>
    );
  };

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

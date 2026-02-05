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
import { getAvailableChainNames } from '@/utils/chainNames';
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
      console.log('[Modal] StartChainModal opened');
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
    console.log('[Step: Name] Chain name entered:', chainName || '(default)');
    setStep('recipient');
  };

  const handleRecipientNext = () => {
    if (!validateRecipient()) return;
    console.log('[Step: Recipient] Type:', recipientType, 'Value:', recipientValue);
    setStep('category');
  };

  const handleCategorySelect = (category: ComplimentCategory) => {
    console.log('[Step: Category] Selected:', category.name);
    setSelectedCategory(category);
    setStep('compliment');
  };

  const handleComplimentSelect = (compliment: string) => {
    console.log('[Step: Compliment] Selected:', compliment);
    console.log('=== CHAIN CREATION STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
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
    console.log('=== CHAIN CREATION VIA EDGE FUNCTION ===');
    console.log('Timestamp:', new Date().toISOString());

    // Finalize chain name
    const finalName = chainName.trim() || `@${displayName}'s Chain`;
    console.log('Chain name:', finalName);
    console.log('Recipient:', recipientValue.trim());

    try {
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      // Call edge function with 30s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      console.log('Calling create-chain edge function...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-chain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            chainName: finalName,
            recipientValue: recipientValue.trim(),
            compliment: compliment
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      console.log('Response status:', response.status);

      const result = await response.json();
      console.log('Response body:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create chain');
      }

      if (!result.chain) {
        throw new Error('No chain returned from server');
      }

      console.log('Chain created successfully:', result.chain.chain_id);

      // Success!
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
      console.error('=== CHAIN CREATION FAILED ===');
      console.error('Error:', error);
      
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

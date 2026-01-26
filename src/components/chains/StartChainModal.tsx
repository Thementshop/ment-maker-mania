import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, ArrowLeft, Send, Check, User, Mail, Phone, Sparkles, Flame } from 'lucide-react';
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
import { useMentChains } from '@/hooks/useMentChains';
import { complimentCategories, type ComplimentCategory } from '@/data/compliments';
import confetti from 'canvas-confetti';

interface StartChainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RecipientType = 'contact' | 'email' | 'phone';

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address').max(255);
const phoneSchema = z.string().min(10, 'Please enter a valid phone number').max(20);
const contactSchema = z.string().min(1, 'Please enter a name').max(100);

const StartChainModal = ({ isOpen, onClose }: StartChainModalProps) => {
  const { toast } = useToast();
  const { startChain } = useMentChains();
  
  // Step management
  const [step, setStep] = useState<'recipient' | 'category' | 'compliment' | 'sending' | 'success'>('recipient');
  
  // Recipient state
  const [recipientType, setRecipientType] = useState<RecipientType>('contact');
  const [recipientValue, setRecipientValue] = useState('');
  const [recipientError, setRecipientError] = useState('');
  
  // Compliment state
  const [selectedCategory, setSelectedCategory] = useState<ComplimentCategory | null>(null);
  const [selectedCompliment, setSelectedCompliment] = useState('');
  
  const resetModal = useCallback(() => {
    setStep('recipient');
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

  const validateRecipient = (): boolean => {
    try {
      if (recipientType === 'email') {
        emailSchema.parse(recipientValue);
      } else if (recipientType === 'phone') {
        phoneSchema.parse(recipientValue);
      } else {
        contactSchema.parse(recipientValue);
      }
      setRecipientError('');
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setRecipientError(err.errors[0].message);
      }
      return false;
    }
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
    setStep('sending');
    
    try {
      // Chain expires in 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const chain = await startChain(recipientValue, compliment, expiresAt);

      if (chain) {
        setStep('success');
        
        // Fire confetti!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF6B35', '#F7931E', '#FFD23F', '#2ECC71']
        });

        // Auto close after success
        setTimeout(() => {
          handleClose();
        }, 2500);
      } else {
        throw new Error('Failed to start chain');
      }
    } catch (error) {
      toast({
        title: "Failed to start chain",
        description: "Please try again",
        variant: "destructive"
      });
      setStep('recipient');
    }
  };

  const handleBack = () => {
    switch (step) {
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
        <h3 className="text-lg font-semibold">Start a New Chain!</h3>
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

      <Button onClick={handleRecipientNext} className="w-full" size="lg" disabled={!recipientValue.trim()}>
        Choose a Ment
      </Button>
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
          You've sparked a new chain of kindness
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-orange-500">
          <Sparkles className="h-5 w-5" />
          <span className="font-semibold">24h Timer Started</span>
          <Sparkles className="h-5 w-5" />
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Start a Chain
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
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

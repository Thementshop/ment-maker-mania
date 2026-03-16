import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Heart, ArrowLeft, Send, Check, User, Mail, Phone, Sparkles } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useMentChains, type MentChain, type ChainLink } from '@/hooks/useMentChains';
import { complimentCategories, type ComplimentCategory } from '@/data/compliments';
import confetti from 'canvas-confetti';

interface ChainPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: MentChain;
  receivedCompliment: string;
}

type PassChoice = 'share' | 'custom';
type RecipientType = 'contact' | 'email' | 'phone';

interface RecipientData {
  type: RecipientType;
  value: string;
}

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address').max(255);
const phoneSchema = z.string().min(10, 'Please enter a valid phone number').max(20);
const contactSchema = z.string().min(1, 'Please enter a name').max(100);

const ChainPassModal = ({ isOpen, onClose, chain, receivedCompliment }: ChainPassModalProps) => {
  const { toast } = useToast();
  const { passChain } = useMentChains();
  
  // Step management
  const [step, setStep] = useState<'choice' | 'recipient' | 'category' | 'compliment' | 'sending' | 'success'>('choice');
  const [passChoice, setPassChoice] = useState<PassChoice>('custom');
  
  // Recipient state
  const [recipientType, setRecipientType] = useState<RecipientType>('contact');
  const [recipientValue, setRecipientValue] = useState('');
  const [recipientError, setRecipientError] = useState('');
  
  // Compliment state
  const [selectedCategory, setSelectedCategory] = useState<ComplimentCategory | null>(null);
  const [selectedCompliment, setSelectedCompliment] = useState('');
  
  const resetModal = useCallback(() => {
    setStep('choice');
    setPassChoice('custom');
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

  const handleChoiceNext = () => {
    setStep('recipient');
  };

  const handleRecipientNext = () => {
    if (!validateRecipient()) return;
    
    if (passChoice === 'share') {
      // Skip compliment selection, use received compliment
      setSelectedCompliment(receivedCompliment);
      handleSend(receivedCompliment);
    } else {
      setStep('category');
    }
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
      const success = await passChain(
        chain.chain_id,
        recipientValue,
        receivedCompliment,
        compliment
      );

      if (success) {
        setStep('success');
        
        // Fire confetti!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#58fc59', '#3ed83f', '#1ABC9C', '#16A085']
        });

        // Auto close after success
        setTimeout(() => {
          handleClose();
        }, 2500);
      } else {
        throw new Error('Failed to pass chain');
      }
    } catch (error) {
      toast({
        title: "Failed to pass chain",
        description: "Please try again",
        variant: "destructive"
      });
      setStep('recipient');
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'recipient':
        setStep('choice');
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

  const renderChoiceStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Link2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Pass the Chain!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Keep the kindness going by passing this chain forward
        </p>
      </div>

      {/* Received Compliment Preview */}
      <div className="bg-secondary/30 rounded-xl p-4 border border-border">
        <p className="text-xs text-muted-foreground mb-2">You received:</p>
        <p className="text-sm font-medium text-foreground">"{receivedCompliment}"</p>
      </div>

      {/* Choice Options */}
      <RadioGroup value={passChoice} onValueChange={(v) => setPassChoice(v as PassChoice)} className="space-y-3">
        <label 
          className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            passChoice === 'share' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          <RadioGroupItem value="share" className="mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <span className="font-semibold">Share this Ment</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Keep the vibe going 🔗 Forward the same compliment you received
            </p>
          </div>
        </label>

        <label 
          className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            passChoice === 'custom' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          <RadioGroupItem value="custom" className="mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <span className="font-semibold">Choose your own</span>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Recommended</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Make it personal 💚 Pick a new compliment to send
            </p>
          </div>
        </label>
      </RadioGroup>

      <Button onClick={handleChoiceNext} className="w-full" size="lg">
        Continue
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
        <h3 className="text-lg font-semibold">Who's Next?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose who will receive this chain
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

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleRecipientNext} className="flex-1" disabled={!recipientValue.trim()}>
          {passChoice === 'share' ? 'Send Chain' : 'Next'}
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
          What kind of ment do you want to send?
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
          Pick the perfect ment
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
        className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
      >
        <Send className="h-10 w-10 text-primary" />
      </motion.div>
      <p className="mt-4 text-lg font-semibold">Passing the chain...</p>
      <p className="text-sm text-muted-foreground">Spreading kindness ✨</p>
    </motion.div>
  );

  const renderSuccessStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      >
        <Check className="h-10 w-10 text-primary-foreground" />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-xl font-bold text-foreground mb-2">Chain Passed! 🎉</h3>
        <p className="text-muted-foreground">
          You've added a new link to the chain
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="font-semibold">+1 Link Added</span>
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
            <Link2 className="h-5 w-5 text-primary" />
            Pass the Chain
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'choice' && renderChoiceStep()}
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

export default ChainPassModal;

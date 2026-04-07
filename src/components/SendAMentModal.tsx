import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Smartphone, Users, Send } from 'lucide-react';
import { complimentCategories, ComplimentCategory } from '@/data/compliments';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import SavedContactsDropdown from '@/components/SavedContactsDropdown';
import confetti from 'canvas-confetti';
import wrappedMint from '@/assets/wrapped-mint.png';
import unwrappedMint from '@/assets/unwrapped-mint.png';

interface SendAMentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'method' | 'email' | 'category' | 'compliment' | 'sending' | 'success';

const SendAMentModal = ({ isOpen, onClose }: SendAMentModalProps) => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('method');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ComplimentCategory | null>(null);
  const [selectedCompliment, setSelectedCompliment] = useState('');
  const [emailError, setEmailError] = useState('');

  const resetModal = () => {
    setStep('method');
    setRecipientEmail('');
    setSelectedCategory(null);
    setSelectedCompliment('');
    setEmailError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) { setEmailError('Please enter an email address'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Please enter a valid email'); return false; }
    if (email.toLowerCase() === user?.email?.toLowerCase()) { setEmailError("You can't send a ment to yourself"); return false; }
    setEmailError('');
    return true;
  };

  const handleEmailNext = () => {
    if (validateEmail(recipientEmail)) setStep('category');
  };

  const handleCategorySelect = (category: ComplimentCategory) => {
    setSelectedCategory(category);
    setStep('compliment');
  };

  const handleComplimentSelect = async (compliment: string) => {
    setSelectedCompliment(compliment);
    // Send immediately after selecting compliment
    await handleSend(compliment);
  };

  const handleSend = async (compliment?: string) => {
    if (!user || !session) return;
    if (!recipientEmail.trim()) {
      toast({ title: "No recipient", description: "Please enter an email address first.", variant: "destructive" });
      setStep('email');
      return;
    }
    const complimentToSend = compliment || selectedCompliment;
    setStep('sending');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-a-ment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            recipient_email: recipientEmail.trim(),
            compliment_text: complimentToSend,
            compliment_category: selectedCategory?.id || '',
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send ment');

      if (result.new_jar_count) {
        const { useGameStore } = await import('@/store/gameStore');
        useGameStore.setState({ jarCount: result.new_jar_count });
      }

      setStep('success');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#58fc59', '#FF6B9D', '#4FC3F7', '#FFD740', '#B39DDB'] });
      toast({ title: "Compliment sent! +1 mint earned 💚", description: `Your ment was sent to ${recipientEmail}` });
      setTimeout(() => handleClose(), 2500);
    } catch (error: any) {
      toast({ title: "Couldn't send ment", description: error.message || 'Please try again', variant: "destructive" });
      setStep('email');
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'email': setStep('method'); break;
      case 'category': setStep('email'); break;
      case 'compliment': setStep('category'); break;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {step !== 'sending' && step !== 'success' && (
              <button onClick={handleClose} className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Step 1: Method Selection */}
            {step === 'method' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Send className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">Send A Ment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">💚 No timer, no pressure – just spread kindness!</p>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground text-center">How do you want to send?</h3>
                  <button
                    onClick={() => setStep('email')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <Mail className="h-6 w-6 text-primary" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">📧 Email</div>
                      <div className="text-xs text-muted-foreground">Send via email address</div>
                    </div>
                  </button>
                  <button
                    disabled
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-muted/30 opacity-50 cursor-not-allowed"
                  >
                    <Smartphone className="h-6 w-6 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-semibold text-muted-foreground">📱 Phone</div>
                      <div className="text-xs text-muted-foreground">Coming Soon</div>
                    </div>
                  </button>
                  <button
                    disabled
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-muted/30 opacity-50 cursor-not-allowed"
                  >
                    <Users className="h-6 w-6 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-semibold text-muted-foreground">👥 Contacts</div>
                      <div className="text-xs text-muted-foreground">Coming Soon</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Email Input */}
            {step === 'email' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-foreground">📧 Enter Email</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Who are you sending kindness to?</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Recipient Email</label>
                  <SavedContactsDropdown
                    value={recipientEmail}
                    onChange={(val) => { setRecipientEmail(val); setEmailError(''); }}
                    onSelect={(email) => { setRecipientEmail(email); setEmailError(''); }}
                    placeholder="friend@example.com"
                  />
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>
                <button
                  onClick={handleEmailNext}
                  disabled={!recipientEmail.trim()}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  Choose Ment →
                </button>
                <button onClick={handleBack} className="w-full text-sm text-muted-foreground hover:text-foreground">← Back</button>
              </div>
            )}

            {/* Step 3: Category */}
            {step === 'category' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-foreground">Choose Category</h2>
                  <p className="mt-1 text-sm text-muted-foreground">What kind of ment?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {complimentCategories.map((category) => (
                    <motion.button
                      key={category.id}
                      onClick={() => handleCategorySelect(category)}
                      className={`${category.gradient} flex flex-col items-center gap-2 rounded-2xl p-4 text-primary-foreground shadow-md`}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-3xl">{category.emoji}</span>
                      <span className="font-display text-sm font-semibold">{category.name}</span>
                    </motion.button>
                  ))}
                </div>
                <button onClick={handleBack} className="w-full text-sm text-muted-foreground hover:text-foreground">← Back</button>
              </div>
            )}

            {/* Step 4: Compliment */}
            {step === 'compliment' && selectedCategory && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {selectedCategory.emoji} {selectedCategory.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">Pick a ment to send</p>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
                  {selectedCategory.compliments.map((compliment, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleComplimentSelect(compliment)}
                      className="w-full rounded-xl border-2 border-border bg-card p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    >
                      {compliment}
                    </motion.button>
                  ))}
                </div>
                <button onClick={handleBack} className="w-full text-sm text-muted-foreground hover:text-foreground">← Back to categories</button>
              </div>
            )}

            {/* Step 5: Sending Animation */}
            {step === 'sending' && (
              <div className="flex flex-col items-center justify-center py-12">
                <motion.div className="relative"
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1, 1.1, 0.8], rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                >
                  <motion.img src={wrappedMint} alt="Unwrapping..." className="h-32 w-32 object-contain"
                    initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 1, 0.5, 0] }} transition={{ duration: 2 }} />
                  <motion.img src={unwrappedMint} alt="Mint" className="absolute inset-0 h-32 w-32 object-contain"
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 0, 0, 0.5, 1], scale: [0.5, 0.5, 0.5, 0.8, 1] }} transition={{ duration: 2 }} />
                </motion.div>
                <motion.p className="mt-6 font-display text-lg text-muted-foreground"
                  animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>
                  Sending your ment...
                </motion.p>
              </div>
            )}

            {/* Step 6: Success */}
            {step === 'success' && (
              <motion.div className="flex flex-col items-center justify-center py-12"
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <motion.div animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 0.5, repeat: 2 }}>
                  <img src={unwrappedMint} alt="Sent!" className="h-24 w-24 object-contain" />
                </motion.div>
                <motion.h2 className="mt-6 font-display text-2xl font-bold text-primary"
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  🎊 Ment Delivered! 🎊
                </motion.h2>
                <motion.p className="mt-2 text-muted-foreground"
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                  +1 mint added to your jar!
                </motion.p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SendAMentModal;

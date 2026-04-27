import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Mail } from 'lucide-react';
import { complimentCategories, ComplimentCategory } from '@/data/compliments';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ContactSelector, { type UserContact } from '@/components/ContactSelector';
import AddContactForm from '@/components/AddContactForm';
import { supabase } from '@/integrations/supabase/client';
import { getFreshAccessToken } from '@/utils/freshToken';
import confetti from 'canvas-confetti';
import wrappedMint from '@/assets/wrapped-mint.png';
import unwrappedMint from '@/assets/unwrapped-mint.png';

interface SendAMentModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledCompliment?: string | null;
  prefilledCategory?: string | null;
  prefilledSenderName?: string | null;
}

type Step = 'contact' | 'addContact' | 'delivery' | 'category' | 'compliment' | 'sending' | 'success';

const SendAMentModal = ({
  isOpen,
  onClose,
  prefilledCompliment,
  prefilledCategory,
  prefilledSenderName,
}: SendAMentModalProps) => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('contact');
  const [selectedContact, setSelectedContact] = useState<UserContact | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'text' | 'email'>('text');
  const [selectedCategory, setSelectedCategory] = useState<ComplimentCategory | null>(null);
  const [selectedCompliment, setSelectedCompliment] = useState('');

  const isPrefilled = !!prefilledCompliment;

  // When the modal opens with a prefilled compliment, lock it in immediately.
  // Skips the category + compliment selection steps entirely.
  useState(() => {
    if (prefilledCompliment) {
      setSelectedCompliment(prefilledCompliment);
      if (prefilledCategory) {
        const cat = complimentCategories.find(c => c.id === prefilledCategory) || null;
        setSelectedCategory(cat);
      }
    }
  });

  const resetModal = () => {
    setStep('contact');
    setSelectedContact(null);
    setDeliveryMethod('text');
    if (!isPrefilled) {
      setSelectedCategory(null);
      setSelectedCompliment('');
    }
  };

  const handleClose = () => { resetModal(); onClose(); };

  const handleContactSelected = (contact: UserContact) => {
    setSelectedContact(contact);
    // If contact has both phone and email, let user pick; otherwise skip to category
    if (contact.phone && contact.email) {
      setDeliveryMethod(contact.delivery_preference === 'email' ? 'email' : 'text');
      setStep('delivery');
    } else {
      setDeliveryMethod(contact.phone ? 'text' : 'email');
      setStep('category');
    }
  };

  const handleNewContactSaved = (contact: UserContact) => {
    setSelectedContact(contact);
    setDeliveryMethod(contact.phone ? 'text' : 'email');
    setStep('category');
  };

  const handleCategorySelect = (category: ComplimentCategory) => {
    setSelectedCategory(category);
    setStep('compliment');
  };

  const handleComplimentSelect = async (compliment: string) => {
    setSelectedCompliment(compliment);
    await handleSend(compliment);
  };

  const handleSend = async (compliment?: string) => {
    if (!user || !selectedContact) return;
    const complimentToSend = compliment || selectedCompliment;

    // Pre-flight: SMS is not live yet. If user picked text but contact has no email
    // for fallback, fail fast with a clear error instead of hanging.
    if (deliveryMethod === 'text' && !selectedContact.email) {
      toast({
        title: "Can't send to this contact yet",
        description: "This contact doesn't have an email address. Please add an email to send them a Ment, or add your phone number to enable SMS.",
        variant: "destructive",
      });
      return;
    }
    if (deliveryMethod === 'email' && !selectedContact.email) {
      toast({
        title: "No email on file",
        description: "This contact doesn't have an email address. Please add one to send them a Ment.",
        variant: "destructive",
      });
      return;
    }

    setStep('sending');

    // Safety timeout — never let the spinner run forever.
    // Generous (30s) to cover edge function cold starts + Resend latency.
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
      setStep('contact');
    }, 30000);

    try {
      const accessToken = await getFreshAccessToken();
      if (!accessToken) {
        window.clearTimeout(timeoutId);
        toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
        setStep('contact');
        return;
      }
      const recipientIdentifier = deliveryMethod === 'text' ? selectedContact.phone : selectedContact.email;

      if (deliveryMethod === 'email' && selectedContact.email) {
        // Use existing email flow
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-a-ment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              recipient_email: selectedContact.email,
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
          useGameStore.setState(s => ({ totalSent: s.totalSent + 1 }));
        }
      } else if (deliveryMethod === 'text' && selectedContact.phone) {
        // Use SMS placeholder
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              phone_number: selectedContact.phone,
              recipient_name: selectedContact.contact_name,
              sender_name: user.email?.split('@')[0] || 'Someone',
              reveal_url: 'https://ment-maker-mania.lovable.app',
            }),
          }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to send SMS');

        // SMS is a placeholder until Twilio is wired up — silently fall back to email below.
        // (No toast here; the success toast at the end covers delivery confirmation.)

        // Fallback: send via email if available
        if (selectedContact.email) {
          const emailResp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-a-ment`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                recipient_email: selectedContact.email,
                compliment_text: complimentToSend,
                compliment_category: selectedCategory?.id || '',
              }),
            }
          );
          const emailResult = await emailResp.json();
          if (emailResult.new_jar_count) {
            const { useGameStore } = await import('@/store/gameStore');
            useGameStore.setState({ jarCount: emailResult.new_jar_count });
            useGameStore.setState(s => ({ totalSent: s.totalSent + 1 }));
          }
        }
      }

      // Clear the safety timeout as soon as the send itself returned successfully.
      window.clearTimeout(timeoutId);
      if (timedOut) return; // Timeout already fired and reset UI — bail out.

      // Fire-and-forget: contact stats update should NOT block the success UI.
      supabase
        .from('user_contacts')
        .update({
          total_ments_sent: (selectedContact.total_ments_sent || 0) + 1,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', selectedContact.id)
        .then(({ error }) => { if (error) console.error('[SendAMent] contact stats update failed:', error); });

      setStep('success');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#58fc59', '#FF6B9D', '#4FC3F7', '#FFD740', '#B39DDB'] });
      toast({ title: "Compliment sent! +1 mint earned 💚", description: `Your ment was sent to ${selectedContact.contact_name}` });
      setTimeout(() => handleClose(), 2500);
    } catch (error: any) {
      window.clearTimeout(timeoutId);
      if (timedOut) return;
      toast({ title: "Couldn't send ment", description: error.message || 'Please try again', variant: "destructive" });
      setStep('contact');
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'addContact': setStep('contact'); break;
      case 'delivery': setStep('contact'); break;
      case 'category': setStep(selectedContact?.phone && selectedContact?.email ? 'delivery' : 'contact'); break;
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
              <button onClick={handleClose} className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors z-10">
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Step 1: Contact Selection */}
            {step === 'contact' && (
              <ContactSelector
                onContactSelected={handleContactSelected}
                onNewContact={() => setStep('addContact')}
              />
            )}

            {/* Step 2: Add New Contact */}
            {step === 'addContact' && (
              <AddContactForm
                onSaved={handleNewContactSaved}
                onBack={() => setStep('contact')}
              />
            )}

            {/* Step 3: Delivery Method (only if both phone + email) */}
            {step === 'delivery' && selectedContact && (
              <div className="space-y-5">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-foreground">Send to {selectedContact.contact_name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">How should they receive it?</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => { setDeliveryMethod('text'); setStep('category'); }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                      deliveryMethod === 'text' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Phone className="h-6 w-6 text-primary" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">📱 Text Message</div>
                      <div className="text-xs text-muted-foreground">{selectedContact.phone}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setDeliveryMethod('email'); setStep('category'); }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                      deliveryMethod === 'email' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Mail className="h-6 w-6 text-primary" />
                    <div className="text-left">
                      <div className="font-semibold text-foreground">📧 Email</div>
                      <div className="text-xs text-muted-foreground">{selectedContact.email}</div>
                    </div>
                  </button>
                </div>
                <button onClick={handleBack} className="w-full text-sm text-muted-foreground hover:text-foreground">← Back</button>
              </div>
            )}

            {/* Step 4: Category */}
            {step === 'category' && (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    Sending to <span className="font-medium text-foreground">{selectedContact?.contact_name}</span>
                    {deliveryMethod === 'text' ? ` via 📱` : ` via 📧`}
                  </p>
                  <h2 className="font-display text-2xl font-bold text-foreground">Choose Category</h2>
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

            {/* Step 5: Compliment */}
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

            {/* Step 6: Sending Animation */}
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

            {/* Step 7: Success */}
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

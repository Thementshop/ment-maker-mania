import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Mail, Users } from 'lucide-react';
import { complimentCategories, ComplimentCategory } from '@/data/compliments';
import confetti from 'canvas-confetti';
import wrappedMint from '@/assets/wrapped-mint.png';
import unwrappedMint from '@/assets/unwrapped-mint.png';

interface SendMentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (mentData: { category: string; complimentText: string; recipientType: string }) => void;
}

type Step = 'recipient' | 'category' | 'compliment' | 'sending' | 'success';

const SendMentModal = ({ isOpen, onClose, onSend }: SendMentModalProps) => {
  const [step, setStep] = useState<Step>('recipient');
  const [selectedCategory, setSelectedCategory] = useState<ComplimentCategory | null>(null);
  const [selectedCompliment, setSelectedCompliment] = useState<string>('');
  const [recipientType, setRecipientType] = useState<string>('');
  const [recipientValue, setRecipientValue] = useState<string>('');
  
  const resetModal = () => {
    setStep('recipient');
    setSelectedCategory(null);
    setSelectedCompliment('');
    setRecipientType('');
    setRecipientValue('');
  };
  
  const handleClose = () => {
    resetModal();
    onClose();
  };
  
  const handleSelectRecipient = (type: string) => {
    setRecipientType(type);
    // For demo, skip to category selection
    setStep('category');
  };
  
  const handleSelectCategory = (category: ComplimentCategory) => {
    setSelectedCategory(category);
    setStep('compliment');
  };
  
  const handleSelectCompliment = (compliment: string) => {
    setSelectedCompliment(compliment);
    handleSend(compliment);
  };
  
  const handleSend = (compliment: string) => {
    setStep('sending');
    
    // Animate unwrapping
    setTimeout(() => {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2ECC71', '#FF6B9D', '#4FC3F7', '#FFD740', '#B39DDB'],
      });
      
      setStep('success');
      
      // Call onSend with the ment data
      onSend({
        category: selectedCategory?.name || '',
        complimentText: compliment,
        recipientType: recipientType,
      });
      
      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 2500);
    }, 2000);
  };
  
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };
  
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={handleClose}
        >
          <motion.div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            {step !== 'sending' && step !== 'success' && (
              <button
                onClick={handleClose}
                className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            
            {/* Step 1: Recipient Selection */}
            {step === 'recipient' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="font-display text-2xl font-bold text-foreground">Choose Recipient</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Who will receive your ment?</p>
                </div>
                
                <div className="space-y-3">
                  {[
                    { type: 'contacts', icon: Users, label: 'Select from Contacts', emoji: '📱' },
                    { type: 'email', icon: Mail, label: 'Enter Email Address', emoji: '✉️' },
                    { type: 'phone', icon: Phone, label: 'Enter Phone Number', emoji: '📲' },
                  ].map((option) => (
                    <motion.button
                      key={option.type}
                      onClick={() => handleSelectRecipient(option.type)}
                      className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-mint hover:bg-mint/5"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="text-2xl">{option.emoji}</span>
                      <span className="font-body font-semibold text-foreground">{option.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Step 2: Category Selection */}
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
                      onClick={() => handleSelectCategory(category)}
                      className={`${category.gradient} flex flex-col items-center gap-2 rounded-2xl p-4 text-primary-foreground shadow-md`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-3xl">{category.emoji}</span>
                      <span className="font-display text-sm font-semibold">{category.name}</span>
                    </motion.button>
                  ))}
                </div>
                
                <button
                  onClick={() => setStep('recipient')}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
              </div>
            )}
            
            {/* Step 3: Compliment Selection */}
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
                      onClick={() => handleSelectCompliment(compliment)}
                      className="w-full rounded-xl border-2 border-border bg-card p-3 text-left text-sm transition-colors hover:border-mint hover:bg-mint/5"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      {compliment}
                    </motion.button>
                  ))}
                </div>
                
                <button
                  onClick={() => setStep('category')}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to categories
                </button>
              </div>
            )}
            
            {/* Step 4: Sending Animation */}
            {step === 'sending' && (
              <div className="flex flex-col items-center justify-center py-12">
                <motion.div
                  className="relative"
                  initial={{ scale: 1 }}
                  animate={{ 
                    scale: [1, 1.1, 1, 1.1, 0.8],
                    rotate: [0, -5, 5, -5, 0],
                  }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                >
                  <motion.img
                    src={wrappedMint}
                    alt="Unwrapping..."
                    className="h-32 w-32 object-contain"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 1, 1, 0.5, 0] }}
                    transition={{ duration: 2 }}
                  />
                  <motion.img
                    src={unwrappedMint}
                    alt="Mint"
                    className="absolute inset-0 h-32 w-32 object-contain"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 0, 0, 0.5, 1], scale: [0.5, 0.5, 0.5, 0.8, 1] }}
                    transition={{ duration: 2 }}
                  />
                </motion.div>
                <motion.p
                  className="mt-6 font-display text-lg text-muted-foreground"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  Unwrapping your ment...
                </motion.p>
              </div>
            )}
            
            {/* Step 5: Success */}
            {step === 'success' && (
              <motion.div 
                className="flex flex-col items-center justify-center py-12"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  <img
                    src={unwrappedMint}
                    alt="Sent!"
                    className="h-24 w-24 object-contain"
                  />
                </motion.div>
                <motion.h2 
                  className="mt-6 font-display text-2xl font-bold text-mint"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  🎊 Ment Delivered! 🎊
                </motion.h2>
                <motion.p
                  className="mt-2 text-muted-foreground"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
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

export default SendMentModal;

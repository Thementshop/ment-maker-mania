import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Send, Trophy, Globe, Pause } from 'lucide-react';
import unwrappedMint from '@/assets/unwrapped-mint.png';
import wrappedMint from '@/assets/wrapped-mint.png';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: <img src={unwrappedMint} alt="Mint" className="w-16 h-16 object-contain" />,
    title: "Collect Ments",
    description: "Start your journey with 25 mints in your jar. Earn 1 extra mint every time you send a compli-ment to brighten someone's day."
  },
  {
    icon: <Send className="w-12 h-12 text-primary" />,
    title: "Send a Compli-Ment",
    description: "Pick from our library of uplifting compliments — or write your own — and send it to anyone via email or text. Each send adds a mint to your jar."
  },
  {
    icon: <img src={wrappedMint} alt="Wrapped Mint" className="w-16 h-16 object-contain" />,
    title: "Start a Chain",
    description: "Send a compliment to up to 3 people and challenge them to pass it forward within 24 hours. Starting a chain rewards YOU with 5 mints instantly — and each recipient earns 1 mint too, but only if they keep the kindness moving within 24 hours!"
  },
  {
    icon: <Heart className="w-12 h-12 text-candy-pink fill-candy-pink" />,
    title: "Receiving a Ment",
    description: "When someone sends you a Ment, you'll get an email or text with a link to unwrap it. Savor your moment 💚 — then send one back or pass one forward within 24 hours to add this mint permanently to your jar. Wait longer and the mint fades away — so keep the kindness flowing!"
  },
  {
    icon: <Pause className="w-12 h-12 text-mint" />,
    title: "Pause Tokens",
    description: "Running low on time? Use a Pause Token to reset a chain's 24-hour timer and keep the kindness alive. Every new account starts with 5 free Pause Tokens — and you earn 1 more automatically every week. Get more time with Pause Tokens anytime in the store."
  },
  {
    icon: <Trophy className="w-12 h-12 text-candy-yellow" />,
    title: "Level Up",
    description: "The more ments you send, the higher you climb! Unlock fun titles from 'Encourage-Ment' to 'Enlighment'."
  },
  {
    icon: <Globe className="w-12 h-12 text-mint" />,
    title: "Join the Movement",
    description: "Every ment you send adds to the global kindness counter. Together, we're making the world sweeter! 🌍"
  }
];

const HowItWorksModal = ({ isOpen, onClose }: HowItWorksModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-8 lg:inset-12 z-50 bg-card rounded-3xl shadow-2xl overflow-hidden
                       border border-border/50 flex flex-col"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-mint/20 to-candy-pink/20 p-6 border-b border-border/30">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-background/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </motion.button>
              
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Heart className="w-8 h-8 text-candy-pink fill-candy-pink" />
                </motion.div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    How The Ment Shop Works
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Spread kindness, one ment at a time
                  </p>
                </div>
              </div>
            </div>
            
            {/* Steps */}
            <div className="overflow-y-auto flex-1 p-6">
              <div className="space-y-6">
                {steps.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-4 items-start"
                  >
                    {/* Step Number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="font-display font-bold text-primary">{index + 1}</span>
                    </div>
                    
                    {/* Icon */}
                    <motion.div 
                      className="flex-shrink-0 w-20 h-20 rounded-2xl bg-background/50 flex items-center justify-center shadow-sm"
                      whileHover={{ scale: 1.05, rotate: 5 }}
                    >
                      {step.icon}
                    </motion.div>
                    
                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <h3 className="font-display font-bold text-lg text-foreground mb-1">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Footer CTA */}
            <div className="p-6 border-t border-border/30 bg-background/50">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full py-3 px-6 bg-gradient-to-r from-mint to-mint-dark rounded-full 
                           font-display font-bold text-white shadow-mint hover:shadow-lg transition-shadow"
              >
                Start Spreading Kindness! 💚
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default HowItWorksModal;

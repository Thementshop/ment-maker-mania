import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import mintIcon from '@/assets/mint-icon.png';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const stepIcon = (
  <img src={mintIcon} alt="Mint" className="w-12 h-12 object-contain rounded-full" />
);

const steps = [
  {
    icon: stepIcon,
    title: "Send a Ment",
    description: "Choose a compliment (or write your own), we'll wrap it up in the prettiest little mint, and off it goes to make someone's whole entire day. Every time you send a Ment, you earn a mint. Send to one person or send to your whole crew — each send earns one mint. Receive a Ment? That's a mint too. And your Kindness Jar just did a tiny little happy dance."
  },
  {
    icon: stepIcon,
    title: "They Unwrap Something Wonderful",
    description: "That special someone you chose will get a little notification that says someone is thinking of them right now. Just that. The anticipation builds, they tap the mint, it unwraps — and inside is a compliment handpicked by you that might just become the sweetest thing that happens to them all week."
  },
  {
    icon: stepIcon,
    title: "Pass It Forward",
    description: "That mint you just received? Send one right back or surprise someone completely new — your call, wonderful human. Every pass forward earns another mint for your jar. No timer, no pressure. Kindness doesn't need a deadline to be extraordinary."
  },
  {
    icon: stepIcon,
    title: "Watch Your Jar Grow",
    description: "Your Kindness Jar keeps track of every sweet thing you do. Watch it fill up mint by mint and honestly we are going to need a moment at every single milestone. One becomes five, five becomes twenty-five, and somewhere along the way you realize — this jar is basically a trophy for being an incredible human."
  },
  {
    icon: stepIcon,
    title: "Start a Chain",
    description: "Start a Ment Chain and set something extraordinary in motion. Five mints land in your jar instantly — the universe's way of saying thank you for being this kind. Every person in the chain has 48 hours to keep the sweetness moving, and if anyone needs a little breathing room, a Pause Token adds 48 more hours to the countdown timer. Watch it travel. Watch it grow. The universe is absolutely watching and it is SO proud."
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
                Start Spreading Kindness! </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default HowItWorksModal;

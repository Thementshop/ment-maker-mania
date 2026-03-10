import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

interface UltimateCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainName: string;
  shareCount: number;
  onShareSocial: () => void;
}

const UltimateCelebrationModal = React.forwardRef<HTMLDivElement, UltimateCelebrationModalProps>(({
  isOpen,
  onClose,
  chainName,
  shareCount,
  onShareSocial,
}, ref) => {
  useEffect(() => {
    if (!isOpen) return;

    const duration = 5000;
    const end = Date.now() + duration;
    const colors = ['#FFD700', '#FFA500', '#FF6347', '#2ECC71', '#A855F7', '#3B82F6'];

    const interval = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }
      confetti({
        particleCount: 80,
        angle: 60 + Math.random() * 60,
        spread: 80,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
        colors,
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg border-2 border-yellow-400 bg-gradient-to-b from-yellow-50 to-white">
        <DialogHeader>
          <DialogTitle className="text-3xl font-extrabold text-center">
            🏆 WORLD-CHANGER! 🏆
          </DialogTitle>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="space-y-4 text-center"
        >
          <p className="text-6xl">🌍✨🎉</p>
          <p className="text-lg font-bold text-foreground">
            Your chain "{chainName}" spread kindness to{' '}
            <span className="text-primary text-2xl">{shareCount.toLocaleString()}+</span> people!
          </p>
          <p className="text-muted-foreground">
            You started something extraordinary. The world is literally better because of you.
          </p>

          <Button
            className="w-full rounded-full bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 text-white font-bold text-lg h-12 hover:opacity-90"
            onClick={onShareSocial}
          >
            SHARE YOUR LEGACY! 📱
          </Button>

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
            Continue
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
});

UltimateCelebrationModal.displayName = 'UltimateCelebrationModal';

export default UltimateCelebrationModal;

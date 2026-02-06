import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChainLink {
  passed_by: string;
  passed_by_display_name?: string;
  sent_compliment: string;
  passed_at: string;
}

interface ChainCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainName: string;
  chainId: string;
  totalShares: number;
  links: ChainLink[];
  brokenBy?: string;
  brokenByDisplayName?: string;
}

const ChainCompleteModal = ({
  isOpen,
  onClose,
  chainName,
  chainId,
  totalShares,
  links,
  brokenBy,
  brokenByDisplayName,
}: ChainCompleteModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] p-0 overflow-hidden">
        {/* Header with celebration gradient */}
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background p-6 pb-4">
          <DialogHeader>
            <div className="flex items-center justify-center mb-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
              >
                <Gift className="w-8 h-8 text-primary" />
              </motion.div>
            </div>
            <DialogTitle className="text-center text-xl">
              Your Chain Collected {totalShares} Compliments! 🎉
            </DialogTitle>
            <p className="text-center text-muted-foreground text-sm mt-1">
              "{chainName}" has ended — here's what everyone said:
            </p>
          </DialogHeader>
        </div>

        {/* Compliments list */}
        <ScrollArea className="max-h-[40vh] px-6 pb-4">
          <div className="space-y-3 py-2">
            {links.map((link, index) => (
              <motion.div
                key={`${link.passed_by}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-muted/50 rounded-lg p-3 border border-border/50"
              >
                <div className="flex items-start gap-2">
                  <Heart className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">
                      "{link.sent_compliment}"
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      — @{link.passed_by_display_name || link.passed_by.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-muted/30">
          {brokenBy && (
            <p className="text-xs text-muted-foreground text-center mb-3">
              Chain ended when @{brokenByDisplayName || brokenBy.slice(0, 8)} ran out of time
            </p>
          )}
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={onClose}
            >
              Close
            </Button>
            <Button 
              className="flex-1"
              onClick={() => {
                // Copy all compliments to clipboard
                const text = links.map(l => 
                  `"${l.sent_compliment}" — @${l.passed_by_display_name || l.passed_by.slice(0, 8)}`
                ).join('\n\n');
                navigator.clipboard.writeText(text);
                onClose();
              }}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Save Compliments
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChainCompleteModal;
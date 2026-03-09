import React from 'react';
import { motion } from 'framer-motion';
import { Share2, X, Copy, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getShareBaseUrl } from '@/utils/getBaseUrl';
import { type VisualTier, visualTierConfig } from '@/utils/chainTiers';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainId: string;
  chainName: string;
  shareCount: number;
  visualTier: VisualTier;
  milestone?: number;
}

const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  chainId,
  chainName,
  shareCount,
  visualTier,
  milestone,
}) => {
  const tierInfo = visualTierConfig[visualTier];
  const shareUrl = `${getShareBaseUrl()}/chain/${chainId}`;
  const shareText = milestone
    ? `🎉 My kindness chain "${chainName}" just hit ${shareCount} shares! Join The Ment Shop and spread kindness!`
    : `I'm part of a kindness chain with ${shareCount} shares! ${tierInfo.emoji} Join The Ment Shop!`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied! 🔗');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast.success('Link copied! 🔗');
      } catch {
        toast.error('Could not copy link');
      }
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: chainName, text: shareText, url: shareUrl });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            {milestone
              ? `Your Chain Hit ${milestone} Shares! 🎉`
              : `Share Your Impact ${tierInfo.emoji}`}
          </DialogTitle>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <p className="text-center text-muted-foreground">
            {milestone
              ? 'Worth celebrating! Share your accomplishment on social media?'
              : `"${chainName}" has ${shareCount} shares! Show off your impact.`}
          </p>

          <p className="text-center text-xs text-muted-foreground italic">
            (No mints earned — just bragging rights! 😎)
          </p>

          <div className="space-y-2">
            <Button
              className="w-full rounded-full bg-primary hover:bg-primary/90"
              onClick={handleNativeShare}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share on Social 📱
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={handleTwitterShare}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Share on X / Twitter
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={handleWhatsAppShare}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Share on WhatsApp
            </Button>

            <Button
              variant="ghost"
              className="w-full rounded-full"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onClose}
          >
            Maybe Later
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default SocialShareModal;

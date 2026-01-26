import { useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, MoreHorizontal, ChevronRight, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/useCountdown';
import type { MentChain } from '@/hooks/useMentChains';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import mentChainCardBg from '@/assets/ment-chain-card.png';

interface ChainCardProps {
  chain: MentChain;
  onShare?: (chainId: string) => void;
  onViewDetails?: (chainId: string) => void;
  onPause?: (chainId: string) => void;
}

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

const getTimerColor = (hoursLeft: number, minutesLeft: number): string => {
  const totalMinutes = hoursLeft * 60 + minutesLeft;
  
  if (totalMinutes >= 360) return 'text-primary'; // >= 6 hours (green)
  if (totalMinutes >= 60) return 'text-yellow-500'; // 1-6 hours
  if (totalMinutes >= 10) return 'text-orange-500'; // 10min - 1 hour
  return 'text-red-500'; // < 10 minutes
};

const ChainCard = ({ 
  chain, 
  onShare, 
  onViewDetails,
  onPause 
}: ChainCardProps) => {
  const { toast } = useToast();
  const countdown = useCountdown(chain.expires_at, EIGHT_HOURS_MS);
  
  const timerColor = getTimerColor(countdown.hours, countdown.minutes);

  const handleShare = () => {
    if (onShare) {
      onShare(chain.chain_id);
    } else {
      navigator.clipboard.writeText(`Check out this Ment Chain! Chain #${chain.chain_id.slice(0, 8)}`);
      toast({
        title: "Link copied!",
        description: "Chain link copied to clipboard",
      });
    }
  };

  const formatChainId = (id: string) => {
    // Use last 4 characters as the chain number
    const num = parseInt(id.slice(-4), 16) % 10000;
    return `#${num.toString().padStart(4, '0')}`;
  };

  const formatTimeLeft = () => {
    if (countdown.isExpired) return '0:00';
    const hours = countdown.hours;
    const mins = countdown.minutes.toString().padStart(2, '0');
    const secs = countdown.seconds.toString().padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${mins}:${secs}`;
    }
    return `${countdown.minutes}:${secs}`;
  };

  return (
    <motion.div
      className="relative w-full rounded-3xl overflow-hidden shadow-xl bg-gradient-to-b from-white to-green-50/50 border border-green-100"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header Row */}
      <div className="flex justify-between items-center px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="text-lg font-bold text-foreground">
            Ment Chain {formatChainId(chain.chain_id)}
          </span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20"
            >
              <MoreHorizontal className="h-4 w-4 text-primary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetails?.(chain.chain_id)}>
              View Details
            </DropdownMenuItem>
            {chain.status === 'active' && (
              <DropdownMenuItem onClick={() => onPause?.(chain.chain_id)}>
                Use Pause Token
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Row */}
      <div className="flex justify-between items-center px-5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <span className="text-lg font-bold text-foreground">{chain.links_count} Links</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xl">⏳</span>
          <span className={`text-lg font-bold ${timerColor}`}>
            {formatTimeLeft()} left
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Chain Image Section */}
      <div className="relative mx-4 my-2 rounded-2xl overflow-hidden bg-gradient-to-b from-green-100/50 to-green-200/30 border border-green-200/50">
        <img 
          src={mentChainCardBg} 
          alt="Ment Chain" 
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Footer - Started by / Waiting on */}
      <div className="flex justify-between items-center px-5 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              👤
            </span>
            <span>
              Started by <span className="font-semibold text-foreground">YOU</span>
            </span>
          </div>
          {chain.status === 'active' && (
            <span className="text-sm text-muted-foreground ml-7">
              Currently waiting on <span className="text-primary font-semibold">@{chain.current_holder.slice(0, 8)}</span>
            </span>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="rounded-full px-4 bg-green-50 border-green-200 hover:bg-green-100"
          onClick={handleShare}
        >
          🌿 Share...
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Don't Break The Chain Banner */}
      {chain.status === 'active' && (
        <div className="mx-4 mb-4 rounded-full bg-gradient-to-r from-green-100 via-green-50 to-green-100 border border-green-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="font-semibold text-foreground text-sm">Don't Break The Chain!</span>
          </div>
          <span className="text-lg">🌿</span>
        </div>
      )}
    </motion.div>
  );
};

export default ChainCard;

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, MoreVertical, Link, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCountdown } from '@/hooks/useCountdown';
import type { MentChain } from '@/hooks/useMentChains';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface ChainCardProps {
  chain: MentChain;
  backgroundImage?: string;
  onShare?: (chainId: string) => void;
  onViewDetails?: (chainId: string) => void;
  onPause?: (chainId: string) => void;
}

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

const getTimerColor = (hoursLeft: number, minutesLeft: number): string => {
  const totalMinutes = hoursLeft * 60 + minutesLeft;
  
  if (totalMinutes >= 360) return 'text-green-400'; // >= 6 hours
  if (totalMinutes >= 60) return 'text-yellow-400'; // 1-6 hours
  if (totalMinutes >= 10) return 'text-orange-400'; // 10min - 1 hour
  return 'text-red-400'; // < 10 minutes
};

const getProgressColor = (hoursLeft: number, minutesLeft: number): string => {
  const totalMinutes = hoursLeft * 60 + minutesLeft;
  
  if (totalMinutes >= 360) return 'bg-green-500';
  if (totalMinutes >= 60) return 'bg-yellow-500';
  if (totalMinutes >= 10) return 'bg-orange-500';
  return 'bg-red-500';
};

const ChainCard = ({ 
  chain, 
  backgroundImage,
  onShare, 
  onViewDetails,
  onPause 
}: ChainCardProps) => {
  const { toast } = useToast();
  const countdown = useCountdown(chain.expires_at, EIGHT_HOURS_MS);
  
  const timerColor = getTimerColor(countdown.hours, countdown.minutes);
  const progressColor = getProgressColor(countdown.hours, countdown.minutes);

  const handleShare = () => {
    if (onShare) {
      onShare(chain.chain_id);
    } else {
      // Default share behavior
      navigator.clipboard.writeText(`Check out this Ment Chain! Chain #${chain.chain_id.slice(0, 8)}`);
      toast({
        title: "Link copied!",
        description: "Chain link copied to clipboard",
      });
    }
  };

  const formatChainId = (id: string) => {
    return `#${id.slice(0, 8).toUpperCase()}`;
  };

  const getStatusBadge = () => {
    switch (chain.status) {
      case 'active':
        return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>;
      case 'broken':
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">Broken</span>;
      case 'ended':
        return <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">Ended</span>;
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="relative w-full h-[200px] rounded-xl overflow-hidden shadow-lg border border-border"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Background Image or Gradient Fallback */}
      {backgroundImage ? (
        <img 
          src={backgroundImage} 
          alt="Chain card background" 
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-card to-secondary/30" />
      )}
      
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content Overlay */}
      <div className="relative z-10 h-full p-4 flex flex-col justify-between">
        {/* Top Section */}
        <div className="flex justify-between items-start">
          {/* Chain ID & Status */}
          <div className="flex flex-col gap-1">
            <span className="text-white/90 font-mono text-sm font-semibold">
              {formatChainId(chain.chain_id)}
            </span>
            {getStatusBadge()}
          </div>
          
          {/* Menu Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              >
                <MoreVertical className="h-4 w-4" />
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
        
        {/* Middle Section - Links Count & Timer */}
        <div className="flex justify-between items-center">
          {/* Links Count */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm">
              <Link className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">{chain.links_count}</span>
              <span className="text-xs text-white/60">Links</span>
            </div>
          </div>
          
          {/* Countdown Timer */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <Clock className={`h-4 w-4 ${timerColor}`} />
              <span className={`font-mono text-xl font-bold ${timerColor}`}>
                {countdown.isExpired ? '00:00:00' : countdown.formattedTime}
              </span>
            </div>
            <span className="text-xs text-white/60">Time Remaining</span>
          </div>
        </div>
        
        {/* Bottom Section */}
        <div className="space-y-2">
          {/* Progress Bar */}
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 ${progressColor} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${countdown.percentageRemaining}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          
          {/* Started by / Waiting on */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <User className="h-3 w-3" />
              <span>
                Started by <span className="text-white font-medium">You</span>
                {chain.status === 'active' && (
                  <> • Waiting on <span className="text-primary font-medium">{chain.current_holder.slice(0, 8)}...</span></>
                )}
              </span>
            </div>
            
            {/* Share Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleShare}
            >
              <Share2 className="h-3.5 w-3.5 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChainCard;

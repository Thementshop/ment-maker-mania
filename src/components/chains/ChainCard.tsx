import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, MoreHorizontal, ChevronRight, Flame, Pause, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/useCountdown';
import { usePauseTokens } from '@/hooks/usePauseTokens';
import type { MentChain } from '@/hooks/useMentChains';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import mentChainCardBg from '@/assets/ment-chain-card.png';
import confetti from 'canvas-confetti';
import { getShareBaseUrl } from '@/utils/getBaseUrl';

interface ChainCardProps {
  chain: MentChain;
  onShare?: (chainId: string) => void;
  onViewDetails?: (chainId: string) => void;
  onPauseUsed?: () => void;
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
  onPauseUsed
}: ChainCardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const countdown = useCountdown(chain.expires_at, EIGHT_HOURS_MS);
  const { pauseTokens, usePauseToken, refetch } = usePauseTokens();
  const [isPausing, setIsPausing] = useState(false);
  
  const timerColor = getTimerColor(countdown.hours, countdown.minutes);

  const handleShare = () => {
    const chainUrl = `${getShareBaseUrl()}/chain/${chain.chain_id}`;
    navigator.clipboard.writeText(chainUrl).catch(() => {});
    toast({
      title: "Link copied! 🔗",
      description: "Share this link with anyone",
    });
    if (navigator.share) {
      navigator.share({
        title: `Join this Kindness Chain! 💚`,
        text: `Check out this Ment Chain with ${chain.links_count} links!`,
        url: chainUrl
      }).catch(() => {});
    }
  };

  const handleUsePauseToken = async () => {
    if (pauseTokens <= 0) {
      toast({
        title: "No tokens available",
        description: "Get more tokens in the Store",
      });
      navigate('/store');
      return;
    }

    setIsPausing(true);
    const success = await usePauseToken(chain.chain_id);
    
    if (success) {
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#58fc59', '#3ed83f', '#F1C40F']
      });

      toast({
        title: "Pause token used! ⏸️",
        description: "Timer reset to 24 hours",
      });

      await refetch();
      onPauseUsed?.();
    } else {
      toast({
        title: "Couldn't use token",
        description: "Please try again",
        variant: "destructive"
      });
    }

    setIsPausing(false);
  };

  const formatChainId = (id: string) => {
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

      {/* Action Buttons Row */}
      {chain.status === 'active' && (
        <div className="px-4 pb-4 flex gap-2">
          {/* Don't Break The Chain Banner */}
          <div className="flex-1 rounded-full bg-gradient-to-r from-green-100 via-green-50 to-green-100 border border-green-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="font-semibold text-foreground text-sm">Don't Break The Chain!</span>
            </div>
            <span className="text-lg">🌿</span>
          </div>

          {/* Use Pause Token Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-3 border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-yellow-700"
                onClick={handleUsePauseToken}
                disabled={isPausing}
              >
                {isPausing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <Pause className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    <Ticket className="h-3 w-3" />
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">
                Use Pause Token (+24h)
                <br />
                <span className="text-muted-foreground">You have {pauseTokens} token{pauseTokens !== 1 ? 's' : ''}</span>
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </motion.div>
  );
};

export default ChainCard;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, ChevronRight, Pause, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MintCircleGraphic from './MintCircleGraphic';
import PassChainModal from './PassChainModal';
import ChainDetailsModal from './ChainDetailsModal';
import { useMentChains } from '@/hooks/useMentChains';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ChainData {
  chain_id: string;
  chain_name: string;
  share_count: number;
  tier: 'small' | 'medium' | 'large' | 'legendary';
  expires_at: string;
  started_by: string;
  started_by_display_name: string;
  current_holder: string;
  current_holder_display_name?: string;
  status: 'active' | 'broken';
  is_queued: boolean;
  received_compliment?: string;
}

interface ChainCardNewProps {
  chain: ChainData;
  isYourTurn: boolean;
  currentUserId: string;
  onShare?: (chainId: string) => void;
  onViewDetails?: (chainId: string) => void;
  onChainPassed?: () => void;
}

const getTimerColor = (hours: number, minutes: number): string => {
  const totalMinutes = hours * 60 + minutes;
  
  if (totalMinutes >= 360) return 'bg-green-500 text-white'; // >= 6 hours
  if (totalMinutes >= 60) return 'bg-yellow-500 text-white'; // 1-6 hours
  if (totalMinutes >= 10) return 'bg-orange-500 text-white'; // 10min - 1 hour
  return 'bg-red-500 text-white animate-pulse'; // < 10 minutes
};

const ChainCardNew = ({ 
  chain, 
  isYourTurn,
  currentUserId,
  onShare, 
  onViewDetails,
  onChainPassed,
}: ChainCardNewProps) => {
  const { user } = useAuth();
  const countdown = useCountdown(chain.expires_at);
  const timerColorClass = getTimerColor(countdown.hours, countdown.minutes);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseTokens, setPauseTokens] = useState(0);
  const { usePauseToken } = useMentChains();
  const navigate = useNavigate();

  // Fetch pause tokens
  useEffect(() => {
    if (!user) return;
    
    const fetchPauseTokens = async () => {
      const { data } = await supabase
        .from('user_game_state')
        .select('pause_tokens')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setPauseTokens(data.pause_tokens);
      }
    };
    
    fetchPauseTokens();
  }, [user]);

  const handleShare = () => {
    if (isYourTurn && chain.status === 'active' && !chain.is_queued) {
      setShowPassModal(true);
    } else {
      onShare?.(chain.chain_id);
    }
  };

  const handleViewDetails = () => {
    setShowDetailsModal(true);
  };

  const handlePassSuccess = () => {
    onChainPassed?.();
  };

  const handleUsePauseToken = async () => {
    if (pauseTokens < 1) {
      toast.error('No pause tokens available!');
      return;
    }

    setIsPausing(true);
    try {
      const success = await usePauseToken(chain.chain_id);
      if (success) {
        toast.success('⏸️ Chain paused! Timer reset to 24:00:00');
        onChainPassed?.();
      } else {
        toast.error('Failed to use pause token');
      }
    } catch (error) {
      toast.error('Failed to pause chain');
    } finally {
      setIsPausing(false);
    }
  };

  // Default compliment if none received
  const receivedCompliment = chain.received_compliment || "You're amazing and the world is better with you in it! 💚";

  return (
    <>
      <motion.div
        className={`relative w-full rounded-2xl overflow-hidden shadow-lg border transition-all ${
          chain.tier === 'legendary' 
            ? 'bg-gradient-to-b from-emerald-50 to-white border-emerald-300 shadow-emerald-200/50' 
            : 'bg-white border-border'
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.2 }}
      >
        {/* Countdown Timer Badge - ONLY if isYourTurn and not queued */}
        {isYourTurn && !chain.is_queued && chain.status === 'active' && (
          <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold z-10 ${timerColorClass}`}>
            <span>⏳</span>
            <span>{countdown.formattedTime} left</span>
          </div>
        )}

        {/* Menu Button (top right) */}
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm"
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewDetails}>
                View Details
              </DropdownMenuItem>
              {!isYourTurn && (
                <DropdownMenuItem onClick={() => onShare?.(chain.chain_id)}>
                  Share Chain Link
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mint Circle Graphic */}
        <div className="flex justify-center pt-12 pb-4 px-6">
          <div className="w-40 h-40">
            <MintCircleGraphic 
              shareCount={chain.share_count} 
              tier={chain.tier} 
            />
          </div>
        </div>

        {/* Chain Name */}
        <div className="text-center px-4">
          <h3 className="text-xl font-bold text-foreground">
            {chain.chain_name || `Chain #${chain.chain_id.slice(0, 6)}`}
          </h3>
        </div>

        {/* Started By */}
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-muted-foreground">
            Started by <span className="font-medium text-foreground">@{chain.started_by_display_name}</span>
          </p>
        </div>

        {/* Current Status */}
        <div className="text-center mt-2 px-4 pb-4">
          {chain.status === 'broken' ? (
            <span className="text-sm text-red-500 font-medium">💔 Chain Broken</span>
          ) : isYourTurn ? (
            <span className="text-sm text-primary font-semibold">🎯 Your turn!</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Waiting on <span className="text-primary font-medium">@{chain.current_holder_display_name || chain.current_holder.slice(0, 8)}</span>
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 space-y-2">
          {isYourTurn && !chain.is_queued && chain.status === 'active' ? (
            <>
              <Button 
                className="w-full rounded-full bg-primary hover:bg-primary/90"
                onClick={handleShare}
              >
                Share →
              </Button>
              
              {/* Pause Token Button */}
              {pauseTokens > 0 ? (
                <Button
                  variant="outline"
                  className="w-full rounded-full text-sm"
                  onClick={handleUsePauseToken}
                  disabled={isPausing}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  {isPausing ? 'Pausing...' : `Use Pause Token (${pauseTokens})`}
                </Button>
              ) : countdown.hours < 2 ? (
                <Button
                  variant="ghost"
                  className="w-full rounded-full text-xs text-muted-foreground"
                  onClick={() => navigate('/store')}
                >
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Need more time? Buy Pause Tokens
                </Button>
              ) : null}
            </>
          ) : chain.is_queued ? (
            <div className="w-full py-2 rounded-full bg-muted text-center text-muted-foreground font-medium">
              ⏸️ Queued
            </div>
          ) : (
            <Button 
              variant="outline"
              className="w-full rounded-full"
              onClick={handleViewDetails}
            >
              View Details <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* Pass Chain Modal */}
      <PassChainModal
        chain={{
          chain_id: chain.chain_id,
          chain_name: chain.chain_name,
          share_count: chain.share_count,
          started_by: chain.started_by,
          current_holder: chain.current_holder,
          tier: chain.tier
        }}
        receivedCompliment={receivedCompliment}
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        onSuccess={handlePassSuccess}
      />

      {/* Chain Details Modal */}
      <ChainDetailsModal
        chain={{
          chain_id: chain.chain_id,
          chain_name: chain.chain_name,
          share_count: chain.share_count,
          tier: chain.tier,
          started_by: chain.started_by,
          started_by_display_name: chain.started_by_display_name
        }}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </>
  );
};

export default React.memo(ChainCardNew);

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Pause, ShoppingCart, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MintCircleGraphic from './MintCircleGraphic';
import PassChainModal from './PassChainModal';
import ChainDetailsModal from './ChainDetailsModal';
import SocialShareModal from './SocialShareModal';
import UltimateCelebrationModal from './UltimateCelebrationModal';
import ChainTierBadge from './ChainTierBadge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getVisualTier, visualTierConfig, isMilestone } from '@/utils/chainTiers';

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
  onUsePauseToken?: (chainId: string) => Promise<boolean>;
  getChainLinks?: (chainId: string) => Promise<any[]>;
}

const getTimerColor = (hours: number, minutes: number): string => {
  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes >= 360) return 'bg-green-500 text-white';
  if (totalMinutes >= 60) return 'bg-yellow-500 text-white';
  if (totalMinutes >= 10) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white animate-pulse';
};

const ChainCardNew = ({ 
  chain, 
  isYourTurn,
  currentUserId,
  onShare, 
  onViewDetails,
  onChainPassed,
  onUsePauseToken,
  getChainLinks,
}: ChainCardNewProps) => {
  const { user } = useAuth();
  const countdown = useCountdown(chain.expires_at);
  const timerColorClass = getTimerColor(countdown.hours, countdown.minutes);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showUltimateModal, setShowUltimateModal] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseTokens, setPauseTokens] = useState(0);
  const navigate = useNavigate();

  const visualTier = getVisualTier(chain.share_count);
  const tierInfo = visualTierConfig[visualTier];

  // Fetch pause tokens
  useEffect(() => {
    if (!user) return;
    const fetchPauseTokens = async () => {
      const { data } = await supabase
        .from('user_game_state')
        .select('pause_tokens')
        .eq('user_id', user.id)
        .single();
      if (data) setPauseTokens(data.pause_tokens);
    };
    fetchPauseTokens();
  }, [user]);

  // Show ultimate celebration on first view for 1000+ chains you started
  useEffect(() => {
    if (
      chain.share_count >= 1000 &&
      chain.started_by === currentUserId
    ) {
      const seenKey = `ultimate_seen_${chain.chain_id}`;
      if (!sessionStorage.getItem(seenKey)) {
        sessionStorage.setItem(seenKey, 'true');
        setShowUltimateModal(true);
      }
    }
  }, [chain.chain_id, chain.share_count, chain.started_by, currentUserId]);

  const handlePassForward = () => {
    if (isYourTurn && chain.status === 'active' && !chain.is_queued) {
      setShowPassModal(true);
    } else {
      onShare?.(chain.chain_id);
    }
  };

  const handlePassSuccess = () => {
    // Check for milestone after passing
    const newCount = chain.share_count + 1;
    if (isMilestone(newCount) && chain.started_by === currentUserId) {
      toast.success(`🎉 Your chain reached ${newCount} shares! Share this milestone?`);
      setTimeout(() => setShowSocialModal(true), 1500);
    }
    onChainPassed?.();
  };

  const handleUsePauseToken = async () => {
    if (pauseTokens < 1) {
      toast.error('No pause tokens available!');
      return;
    }
    if (!onUsePauseToken) {
      toast.error('Pause token feature not available');
      return;
    }
    setIsPausing(true);
    try {
      const success = await onUsePauseToken(chain.chain_id);
      if (success) {
        toast.success('⏸️ Chain paused! Timer reset to 24:00:00');
        onChainPassed?.();
      } else {
        toast.error('Failed to use pause token');
      }
    } catch {
      toast.error('Failed to pause chain');
    } finally {
      setIsPausing(false);
    }
  };

  const receivedCompliment = chain.received_compliment || "You're amazing and the world is better with you in it! 💚";

  return (
    <>
      <motion.div
        className={`relative w-full rounded-2xl overflow-hidden shadow-lg border transition-all ${tierInfo.cardClass} ${
          visualTier === 'ultimate'
            ? 'bg-gradient-to-b from-yellow-50 via-orange-50 to-white border-yellow-400'
            : chain.tier === 'legendary' 
              ? 'bg-gradient-to-b from-emerald-50 to-white border-emerald-300 shadow-emerald-200/50' 
              : 'bg-white border-border'
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.2 }}
      >
        {/* YOUR TURN header banner */}
        {isYourTurn && !chain.is_queued && chain.status === 'active' && (
          <div className="w-full px-4 pt-3 flex items-center justify-between gap-2 z-10">
            <span className="text-lg font-extrabold text-destructive tracking-tight">🎯 YOUR TURN!</span>
            <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${timerColorClass}`}>
              ⏳ {countdown.formattedTime}
            </span>
          </div>
        )}

        {/* Tier Badge */}
        {tierInfo.badge && (
          <div className="flex justify-center pt-2">
            <ChainTierBadge visualTier={visualTier} shareCount={chain.share_count} />
          </div>
        )}

        {/* Mint Circle Graphic */}
        <div className="flex justify-center pt-6 pb-4 px-6">
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

        {/* Ultimate count */}
        {visualTier === 'ultimate' && (
          <div className="text-center mt-1">
            <span className="text-sm font-bold text-yellow-700">
              {chain.share_count.toLocaleString()} people touched! 🌍
            </span>
          </div>
        )}

        {/* Current Status */}
        <div className="text-center mt-2 px-4 pb-2">
          {chain.status === 'broken' ? (
            <span className="text-sm text-destructive font-medium">💔 Chain Broken</span>
          ) : isYourTurn ? null : (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground block">
                Waiting on <span className="text-primary font-medium">@{chain.current_holder_display_name || chain.current_holder.slice(0, 8)}</span>
              </span>
              {chain.started_by === currentUserId && chain.status === 'active' && (
                <div className="flex flex-col items-center gap-1.5">
                  <span className={`text-xs flex items-center gap-1 ${
                    countdown.hours < 2 ? 'text-destructive' : 
                    countdown.hours < 6 ? 'text-yellow-600' : 'text-muted-foreground'
                  }`}>
                    ⏳ {countdown.formattedTime} remaining
                  </span>
                  {countdown.hours < 6 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:text-primary/80"
                      onClick={() => {
                        toast.success(`Nudge sent to @${chain.current_holder_display_name || 'the current holder'}! 👋`);
                      }}
                    >
                      👋 Send Nudge
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 space-y-2">
          {isYourTurn && !chain.is_queued && chain.status === 'active' ? (
            <>
              <Button 
                className={`w-full rounded-full ${
                  visualTier === 'ultimate'
                    ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 text-white hover:opacity-90'
                    : 'bg-primary hover:bg-primary/90'
                }`}
                onClick={handlePassForward}
              >
                Pass It Forward →
              </Button>

              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => setShowDetailsModal(true)}
              >
                View Chain History
              </Button>
              
              {/* Pause Token Button */}
              {pauseTokens > 0 ? (
                <Button
                  variant="ghost"
                  className="w-full rounded-full text-sm text-muted-foreground"
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
            <>
              <Button 
                variant="outline"
                className="w-full rounded-full"
                onClick={() => setShowDetailsModal(true)}
              >
                View Details <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {/* Social Share Button — only for 25+ shares */}
          {tierInfo.showSocialShare && chain.status === 'active' && (
            <Button
              variant="ghost"
              className={`w-full rounded-full text-sm ${
                visualTier === 'ultimate'
                  ? 'text-yellow-700 hover:bg-yellow-50 font-bold'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setShowSocialModal(true)}
            >
              <Share2 className="h-4 w-4 mr-2" />
              {visualTier === 'ultimate' ? 'SHARE YOUR LEGACY! 📱' : 'Share Your Contribution 📱'}
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
        getChainLinks={getChainLinks}
      />

      {/* Social Share Modal */}
      <SocialShareModal
        isOpen={showSocialModal}
        onClose={() => setShowSocialModal(false)}
        chainId={chain.chain_id}
        chainName={chain.chain_name}
        shareCount={chain.share_count}
        visualTier={visualTier}
      />

      {/* Ultimate Celebration Modal */}
      <UltimateCelebrationModal
        isOpen={showUltimateModal}
        onClose={() => setShowUltimateModal(false)}
        chainName={chain.chain_name}
        shareCount={chain.share_count}
        onShareSocial={() => {
          setShowUltimateModal(false);
          setShowSocialModal(true);
        }}
      />
    </>
  );
};

export default React.memo(ChainCardNew);

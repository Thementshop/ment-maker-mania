import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link, Clock, User, Share2, ArrowRight, Forward, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { tierConfig, getChainTier } from '@/utils/chainTiers';

interface ChainLink {
  link_id: string;
  chain_id: string;
  passed_by: string;
  passed_to: string;
  passed_at: string;
  received_compliment: string;
  sent_compliment: string;
  was_forwarded: boolean;
}

interface ChainDetailsModalProps {
  chain: {
    chain_id: string;
    chain_name: string;
    share_count: number;
    tier?: string;
    created_at?: string;
    started_by: string;
    started_by_display_name?: string;
    status?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const ChainDetailsModal = ({ chain, isOpen, onClose }: ChainDetailsModalProps) => {
  const [links, setLinks] = useState<ChainLink[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isOpen) {
      fetchChainLinks();
    }
  }, [isOpen, chain.chain_id]);
  
  async function fetchChainLinks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chain_links')
        .select('*')
        .eq('chain_id', chain.chain_id)
        .order('passed_at', { ascending: true });
      
      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error fetching chain links:', error);
      toast.error('Failed to load chain history');
    } finally {
      setLoading(false);
    }
  }

  function handleShareAchievement() {
    const shareText = `🔗 Check out this kindness chain "${chain.chain_name}" with ${chain.share_count} shares!

Join me in spreading positivity! 💚🍬

#MentShop #SpreadKindness`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Ment Shop Chain',
        text: shareText,
        url: 'https://thementshop.com'
      }).catch(err => console.log('Share cancelled', err));
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Chain info copied to clipboard!');
    }
  }

  const tier = chain.tier || getChainTier(chain.share_count);
  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.small;
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{config.emoji}</span>
                  <h2 className="text-xl font-bold text-foreground">
                    {chain.chain_name || 'Kindness Chain'}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Link className="h-4 w-4" />
                    <strong className="text-foreground">{chain.share_count}</strong> shares
                  </span>
                  {chain.started_by_display_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      @{chain.started_by_display_name}
                    </span>
                  )}
                  {chain.created_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatTimeAgo(chain.created_at)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Chain Flow Timeline */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Chain Flow
            </h3>
            
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : links.length > 0 ? (
              <div className="space-y-4">
                {links.map((link, index) => (
                  <motion.div
                    key={link.link_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-3"
                  >
                    {/* Step Number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 bg-muted/50 rounded-lg p-3">
                      <p className="text-sm font-medium text-foreground">
                        <span className="text-primary">@{link.passed_by.slice(0, 8)}</span>
                        <ArrowRight className="h-3 w-3 inline mx-1" />
                        <span className="text-primary">@{link.passed_to.slice(0, 8)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        {link.was_forwarded ? (
                          <>
                            <Forward className="h-3 w-3" />
                            Forwarded same compliment
                          </>
                        ) : (
                          <>
                            <Heart className="h-3 w-3" />
                            Chose personal compliment
                          </>
                        )}
                      </p>
                      {link.sent_compliment && (
                        <p className="text-xs italic text-muted-foreground mt-2 bg-background rounded px-2 py-1">
                          "{link.sent_compliment.slice(0, 60)}..."
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTimeAgo(link.passed_at)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No chain history yet</p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-6 border-t border-border">
            <Button
              onClick={handleShareAchievement}
              className="w-full rounded-full"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share This Chain
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChainDetailsModal;

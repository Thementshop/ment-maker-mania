import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import ChainCardNew, { ChainData } from './ChainCardNew';
import StartChainModal from './StartChainModal';
import ChainDetailsModal from './ChainDetailsModal';
import ChainCompleteModal from './ChainCompleteModal';
import Leaderboard from './Leaderboard';
import { useMentChains, MentChain } from '@/hooks/useMentChains';
import { useBrokenChainNotification } from '@/hooks/useBrokenChainNotification';

const tabs = [
  { id: 'yourTurn', label: 'Your Turn', icon: '🎯' },
  { id: 'active', label: 'Active', icon: '🔥' },
  { id: 'ended', label: 'Chain Memories', icon: '💚' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' }
];

const MEMORIES_PREVIEW_COUNT = 3;

// Transform MentChain from hook to ChainData expected by ChainCardNew
function transformChainToCardData(chain: MentChain): ChainData {
  return {
    chain_id: chain.chain_id,
    chain_name: chain.chain_name || `Chain #${chain.chain_id.slice(0, 6)}`,
    share_count: chain.share_count || 1,
    tier: (chain.tier as 'small' | 'medium' | 'large' | 'legendary') || 'small',
    expires_at: chain.expires_at,
    started_by: chain.started_by,
    started_by_display_name: chain.started_by_display_name || 'Anonymous',
    current_holder: chain.current_holder,
    current_holder_display_name: chain.current_holder_display_name,
    status: chain.status === 'ended' ? 'broken' : chain.status as 'active' | 'broken',
    is_queued: false,
    received_compliment: chain.received_compliment,
  };
}

function sortChains(chains: ChainData[], isHolderFn: (holder: string) => boolean): ChainData[] {
  return [...chains].sort((a, b) => {
    const aIsYourTurn = isHolderFn(a.current_holder);
    const bIsYourTurn = isHolderFn(b.current_holder);
    
    if (aIsYourTurn && !bIsYourTurn) return -1;
    if (!aIsYourTurn && bIsYourTurn) return 1;
    
    if (aIsYourTurn && bIsYourTurn) {
      const aTime = new Date(a.expires_at).getTime() - Date.now();
      const bTime = new Date(b.expires_at).getTime() - Date.now();
      return aTime - bTime;
    }
    
    return b.share_count - a.share_count;
  });
}

const ChainDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [showStartModal, setShowStartModal] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [showAllMemories, setShowAllMemories] = useState(false);
  const [selectedChainForDetails, setSelectedChainForDetails] = useState<ChainData | null>(null);
  const currentUserId = user?.id || '';
  const currentUserEmail = user?.email || '';

  const isCurrentHolder = useCallback((holder: string) => {
    return holder === currentUserId || 
      (currentUserEmail !== '' && holder.toLowerCase() === currentUserEmail.toLowerCase());
  }, [currentUserId, currentUserEmail]);
  // Fetch real chains from database
  const { chains, isLoading, error, refetch, usePauseToken, getChainLinks } = useMentChains();

  // Check for broken chains to show collection modal
  const { brokenChain, markAsViewed } = useBrokenChainNotification();

  // Transform MentChain[] to ChainData[]
  const chainData = useMemo(() => {
    return chains.map(transformChainToCardData);
  }, [chains]);

  // Smart default tab selection — always lead with positive/active states
  const defaultTab = useMemo(() => {
    const hasYourTurn = chainData.some(c => isCurrentHolder(c.current_holder) && c.status === 'active' && !c.is_queued);
    const hasActive = chainData.some(c => c.status === 'active' && !c.is_queued);
    const hasQueued = chainData.some(c => c.is_queued);

    if (hasYourTurn) return 'yourTurn';
    if (hasActive) return 'active';
    if (hasQueued) return 'queued';
    return 'active';
  }, [chainData, currentUserId]);

  useEffect(() => {
    if (chainData.length > 0 && !hasAutoSelected) {
      setActiveTab(defaultTab);
      setHasAutoSelected(true);
    }
  }, [chainData, defaultTab, hasAutoSelected]);

  // Debug: log incoming chainData and filtering
  useEffect(() => {
    if (chainData.length > 0) {
      console.log('[MentChainsDebug][Dashboard] Incoming chainData:', chainData.map(c => ({
        name: c.chain_name,
        id: c.chain_id.slice(0, 8),
        holder: c.current_holder,
        status: c.status,
        isYourTurn: c.current_holder === currentUserId,
        holderIsEmail: !(/^[0-9a-f]{8}-/.test(c.current_holder)),
      })));
    }
  }, [chainData, currentUserId]);

  // Filter chains based on active tab
  const filteredChains = useMemo(() => {
    let result: ChainData[];
    switch (activeTab) {
      case 'active':
        result = chainData.filter(c => c.status === 'active' && !c.is_queued);
        break;
      case 'yourTurn':
        result = chainData.filter(c => isCurrentHolder(c.current_holder) && c.status === 'active' && !c.is_queued);
        break;
      case 'queued':
        result = chainData.filter(c => c.is_queued);
        break;
      case 'ended':
        result = chainData
          .filter(c => c.status === 'broken')
          .sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());
        break;
      case 'leaderboard':
        result = [...chainData].sort((a, b) => b.share_count - a.share_count).slice(0, 10);
        break;
      default:
        result = chainData;
    }
    
    console.log(`[MentChainsDebug][Dashboard] Tab="${activeTab}" filtered: ${result.length}/${chainData.length} chains`, 
      result.map(c => c.chain_name));
    
    if (activeTab === 'yourTurn') {
      console.log('[MentChainsDebug][Dashboard] YourTurn filter detail:', chainData.filter(c => c.status === 'active' && !c.is_queued).map(c => ({
        name: c.chain_name,
        holder: c.current_holder,
        matchesUserId: c.current_holder === currentUserId,
        currentUserId,
      })));
    }
    
    return result;
  }, [activeTab, currentUserId, chainData]);

  // Sort the filtered chains
  const sortedChains = useMemo(() => {
    return sortChains(filteredChains, isCurrentHolder);
  }, [filteredChains, isCurrentHolder]);

  const handleShare = (chainId: string) => {
    console.log('Share chain:', chainId);
  };

  const handleViewDetails = (chainId: string) => {
    const chain = chainData.find(c => c.chain_id === chainId);
    if (chain) {
      setSelectedChainForDetails(chain);
    }
  };

  const handleStartChain = () => {
    setShowStartModal(true);
  };

  const handleChainCreated = () => {
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state - but still allow starting chains
  if (error) {
    return (
      <div className="w-full">
        {/* Header with Start Chain button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🔥 Ment Chains
          </h2>
          <Button
            onClick={handleStartChain}
            className="rounded-full bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Start Chain
          </Button>
        </div>
        
        {/* Error message with retry */}
        <div className="text-center py-12">
          <p className="text-destructive font-medium">Failed to load chains</p>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            Try Again
          </Button>
        </div>
        
        {/* Start Chain Modal */}
        <StartChainModal
          isOpen={showStartModal}
          onClose={() => setShowStartModal(false)}
          onSuccess={handleChainCreated}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          🔥 Ment Chains
        </h2>
        <Button
          onClick={handleStartChain}
          className="rounded-full bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-1" />
          Start Chain
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Tab Content */}
      {activeTab === 'leaderboard' ? (
        <Leaderboard />
      ) : activeTab === 'ended' ? (
        /* Chain Memories — compact summary rows */
        sortedChains.length > 0 ? (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {(showAllMemories ? sortedChains : sortedChains.slice(0, MEMORIES_PREVIEW_COUNT)).map(chain => (
              <button
                key={chain.chain_id}
                onClick={() => handleViewDetails(chain.chain_id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0" aria-hidden>💚</span>
                  <span className="font-semibold text-foreground truncate">{chain.chain_name}</span>
                </div>
                <span className="text-sm text-muted-foreground shrink-0">
                  reached {chain.share_count} {chain.share_count === 1 ? 'person' : 'people'}
                </span>
              </button>
            ))}

            {sortedChains.length > MEMORIES_PREVIEW_COUNT && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => setShowAllMemories(v => !v)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {showAllMemories
                    ? 'Show fewer chain memories'
                    : `See all your chain memories →`}
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">💚</p>
            <p className="text-lg font-semibold text-foreground mb-2">No chain memories yet</p>
            <p className="text-muted-foreground">Completed chains will live here.</p>
          </div>
        )
      ) : (
        /* Chain Cards Grid */
        sortedChains.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {sortedChains.map(chain => (
              <ChainCardNew
                key={chain.chain_id}
                chain={chain}
                isYourTurn={isCurrentHolder(chain.current_holder)}
                currentUserId={currentUserId}
                onShare={handleShare}
                onViewDetails={handleViewDetails}
                onChainPassed={handleChainCreated}
                onUsePauseToken={usePauseToken}
                getChainLinks={getChainLinks}
              />
            ))}
          </motion.div>
        ) : (
          /* Empty State */
          <div className="text-center py-12">
            <p className="text-5xl mb-4">🔗</p>
            <p className="text-lg font-semibold text-foreground mb-2">No chains yet!</p>
            <p className="text-muted-foreground mb-4">Start your first kindness chain or send a compliment</p>
            <div className="flex justify-center gap-3">
              <Button onClick={handleStartChain} className="rounded-full">
                🔗 Start Chain
              </Button>
            </div>
          </div>
        )
      )}


      {/* Start Chain Modal */}
      <StartChainModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onSuccess={handleChainCreated}
      />

      {/* Chain Details Modal */}
      {selectedChainForDetails && (
        <ChainDetailsModal
          chain={{
            chain_id: selectedChainForDetails.chain_id,
            chain_name: selectedChainForDetails.chain_name,
            share_count: selectedChainForDetails.share_count,
            tier: selectedChainForDetails.tier,
            started_by: selectedChainForDetails.started_by,
            started_by_display_name: selectedChainForDetails.started_by_display_name,
          }}
          isOpen={true}
          onClose={() => setSelectedChainForDetails(null)}
          getChainLinks={getChainLinks}
        />
      )}

      {/* Broken Chain Collection Modal */}
      {brokenChain && (
        <ChainCompleteModal
          isOpen={true}
          onClose={() => markAsViewed(brokenChain.chain_id)}
          chainName={brokenChain.chain_name || `Chain #${brokenChain.chain_id.slice(0, 6)}`}
          chainId={brokenChain.chain_id}
          totalShares={brokenChain.share_count}
          links={brokenChain.links}
          brokenBy={brokenChain.broken_by || undefined}
          brokenByDisplayName={brokenChain.broken_by_display_name}
        />
      )}
    </div>
  );
};

export default ChainDashboard;

import { useState, useMemo, useEffect } from 'react';
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
  { id: 'active', label: 'Active', icon: '🔥' },
  { id: 'yourTurn', label: 'Your Turn', icon: '🎯' },
  { id: 'queued', label: 'Queued', icon: '⏸️' },
  { id: 'ended', label: 'Ended', icon: '💔' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' }
];

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
    is_queued: chain.is_queued || false,
    received_compliment: chain.received_compliment,
  };
}

function sortChains(chains: ChainData[], currentUserId: string): ChainData[] {
  return [...chains].sort((a, b) => {
    const aIsYourTurn = a.current_holder === currentUserId;
    const bIsYourTurn = b.current_holder === currentUserId;
    
    // Your Turn chains FIRST
    if (aIsYourTurn && !bIsYourTurn) return -1;
    if (!aIsYourTurn && bIsYourTurn) return 1;
    
    // Within "Your Turn", sort by urgency (least time remaining first)
    if (aIsYourTurn && bIsYourTurn) {
      const aTime = new Date(a.expires_at).getTime() - Date.now();
      const bTime = new Date(b.expires_at).getTime() - Date.now();
      return aTime - bTime;
    }
    
    // Other chains sorted by share count (highest first)
    return b.share_count - a.share_count;
  });
}

const ChainDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [showStartModal, setShowStartModal] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [selectedChainForDetails, setSelectedChainForDetails] = useState<ChainData | null>(null);
  const currentUserId = user?.id || '';
  const currentUserEmail = user?.email || '';

  const isCurrentHolder = (holder: string) => {
    return holder === currentUserId || 
      (currentUserEmail && holder.toLowerCase() === currentUserEmail.toLowerCase());
  };
  // Fetch real chains from database
  const { chains, isLoading, error, refetch, usePauseToken, getChainLinks } = useMentChains();

  // Check for broken chains to show collection modal
  const { brokenChain, markAsViewed } = useBrokenChainNotification();

  // Transform MentChain[] to ChainData[]
  const chainData = useMemo(() => {
    return chains.map(transformChainToCardData);
  }, [chains]);

  // Smart default tab selection
  const defaultTab = useMemo(() => {
    const hasYourTurn = chainData.some(c => c.current_holder === currentUserId && c.status === 'active' && !c.is_queued);
    const hasActive = chainData.some(c => c.status === 'active' && !c.is_queued);
    const hasQueued = chainData.some(c => c.is_queued);
    const hasEnded = chainData.some(c => c.status === 'broken');

    if (hasYourTurn) return 'yourTurn';
    if (hasActive) return 'active';
    if (hasQueued) return 'queued';
    if (hasEnded) return 'ended';
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
        result = chainData.filter(c => c.current_holder === currentUserId && c.status === 'active' && !c.is_queued);
        break;
      case 'queued':
        result = chainData.filter(c => c.is_queued);
        break;
      case 'ended':
        result = chainData.filter(c => c.status === 'broken');
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
    return sortChains(filteredChains, currentUserId);
  }, [filteredChains, currentUserId]);

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
                isYourTurn={chain.current_holder === currentUserId}
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
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No chains in this category yet</p>
            {activeTab === 'yourTurn' && (
              <p className="text-sm mt-2">Chains waiting for you to share will appear here</p>
            )}
            {activeTab === 'active' && (
              <p className="text-sm mt-2">Start a new chain to spread kindness!</p>
            )}
          </div>
        )
      )}

      {/* Start Chain Button (bottom floating) */}
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-20 md:hidden">
        <Button
          onClick={handleStartChain}
          size="lg"
          className="rounded-full shadow-lg bg-primary hover:bg-primary/90 px-6"
        >
          🔗 Start A Chain
        </Button>
      </div>

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

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import ChainCardNew, { ChainData } from './ChainCardNew';
import StartChainModal from './StartChainModal';
import Leaderboard from './Leaderboard';
import { useMentChains, MentChain } from '@/hooks/useMentChains';

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
  const currentUserId = user?.id || '';

  // Fetch real chains from database
  const { chains, isLoading, error, refetch } = useMentChains();

  // Transform MentChain[] to ChainData[]
  const chainData = useMemo(() => {
    return chains.map(transformChainToCardData);
  }, [chains]);

  // Filter chains based on active tab
  const filteredChains = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return chainData.filter(c => c.status === 'active' && !c.is_queued);
      case 'yourTurn':
        return chainData.filter(c => c.current_holder === currentUserId && c.status === 'active' && !c.is_queued);
      case 'queued':
        return chainData.filter(c => c.is_queued);
      case 'ended':
        return chainData.filter(c => c.status === 'broken');
      case 'leaderboard':
        return [...chainData].sort((a, b) => b.share_count - a.share_count).slice(0, 10);
      default:
        return chainData;
    }
  }, [activeTab, currentUserId, chainData]);

  // Sort the filtered chains
  const sortedChains = useMemo(() => {
    return sortChains(filteredChains, currentUserId);
  }, [filteredChains, currentUserId]);

  const handleShare = (chainId: string) => {
    console.log('Share chain:', chainId);
  };

  const handleViewDetails = (chainId: string) => {
    console.log('View details:', chainId);
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

  // Error state
  if (error) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-destructive font-medium">Failed to load chains</p>
        <Button onClick={refetch} variant="outline" className="mt-4">
          Try Again
        </Button>
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
    </div>
  );
};

export default ChainDashboard;

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import ChainCardNew, { ChainData } from './ChainCardNew';
import StartChainModal from './StartChainModal';
import { getChainTier } from '@/utils/chainTiers';

const tabs = [
  { id: 'active', label: 'Active', icon: '🔥' },
  { id: 'yourTurn', label: 'Your Turn', icon: '🎯' },
  { id: 'queued', label: 'Queued', icon: '⏸️' },
  { id: 'ended', label: 'Ended', icon: '💔' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' }
];

// Mock data for testing
const mockChains: ChainData[] = [
  {
    chain_id: '1',
    chain_name: 'Positivity Wave',
    share_count: 34,
    tier: 'medium',
    expires_at: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(), // 14 hours
    started_by: 'user123',
    started_by_display_name: 'Sarah',
    current_holder: 'currentUser',
    current_holder_display_name: 'You',
    status: 'active',
    is_queued: false,
    received_compliment: "You've got this! I believe in you 💪"
  },
  {
    chain_id: '2',
    chain_name: 'Love Loop',
    share_count: 156,
    tier: 'legendary',
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    started_by: 'currentUser',
    started_by_display_name: 'You',
    current_holder: 'user456',
    current_holder_display_name: 'Mike',
    status: 'active',
    is_queued: false,
    received_compliment: "You make my heart smile every single day 💚"
  },
  {
    chain_id: '3',
    chain_name: 'Kindness Ripple',
    share_count: 12,
    tier: 'small',
    expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 min
    started_by: 'user789',
    started_by_display_name: 'Alex',
    current_holder: 'currentUser',
    current_holder_display_name: 'You',
    status: 'active',
    is_queued: false,
    received_compliment: "You're the G.O.A.T. and everyone knows it 🐐"
  },
  {
    chain_id: '4',
    chain_name: 'Joy Express',
    share_count: 67,
    tier: 'large',
    expires_at: new Date(Date.now() + 8 * 60 * 1000).toISOString(), // 8 minutes - urgent!
    started_by: 'currentUser',
    started_by_display_name: 'You',
    current_holder: 'currentUser',
    current_holder_display_name: 'You',
    status: 'active',
    is_queued: false,
    received_compliment: "Your strength inspires everyone around you"
  },
  {
    chain_id: '5',
    chain_name: 'Smile Chain',
    share_count: 5,
    tier: 'small',
    expires_at: new Date(Date.now() - 1000).toISOString(), // expired
    started_by: 'user999',
    started_by_display_name: 'Jamie',
    current_holder: 'user999',
    current_holder_display_name: 'Jamie',
    status: 'broken',
    is_queued: false,
    received_compliment: "Be the reason someone smiles today 😊"
  },
  {
    chain_id: '6',
    chain_name: 'Gratitude Flow',
    share_count: 28,
    tier: 'medium',
    expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    started_by: 'currentUser',
    started_by_display_name: 'You',
    current_holder: 'user111',
    current_holder_display_name: 'Taylor',
    status: 'active',
    is_queued: true,
    received_compliment: "Thinking of you during this difficult time 🕊️"
  }
];

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
  const currentUserId = user?.id || 'currentUser';

  // Filter chains based on active tab
  const filteredChains = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return mockChains.filter(c => c.status === 'active' && !c.is_queued);
      case 'yourTurn':
        return mockChains.filter(c => c.current_holder === currentUserId && c.status === 'active' && !c.is_queued);
      case 'queued':
        return mockChains.filter(c => c.is_queued);
      case 'ended':
        return mockChains.filter(c => c.status === 'broken');
      case 'leaderboard':
        return [...mockChains].sort((a, b) => b.share_count - a.share_count).slice(0, 10);
      default:
        return mockChains;
    }
  }, [activeTab, currentUserId]);

  // Sort the filtered chains
  const sortedChains = useMemo(() => {
    return sortChains(filteredChains, currentUserId);
  }, [filteredChains, currentUserId]);

  const handleShare = (chainId: string) => {
    console.log('Share chain:', chainId);
    // TODO: Implement share modal
  };

  const handleViewDetails = (chainId: string) => {
    console.log('View details:', chainId);
    // TODO: Implement details modal
  };

  const handleStartChain = () => {
    setShowStartModal(true);
  };

  const handleChainCreated = () => {
    // TODO: Refresh chains from database
    console.log('Chain created, refresh list');
  };

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

      {/* Chain Cards Grid */}
      {sortedChains.length > 0 ? (
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
        </div>
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

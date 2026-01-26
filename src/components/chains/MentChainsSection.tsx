import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Clock, Inbox, History, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMentChains } from '@/hooks/useMentChains';
import { useAuth } from '@/contexts/AuthContext';
import ChainCard from './ChainCard';

interface MentChainsSectionProps {
  onStartNewChain?: () => void;
}

const MentChainsSection = ({ onStartNewChain }: MentChainsSectionProps) => {
  const { user } = useAuth();
  const { chains, yourTurnChains, isLoading, error } = useMentChains();
  const [activeTab, setActiveTab] = useState('active');

  // Filter chains by status and ownership
  const categorizedChains = useMemo(() => {
    const now = new Date();
    
    const active = chains.filter(c => c.status === 'active' && c.started_by === user?.id);
    const yourTurn = chains.filter(c => c.status === 'active' && c.current_holder === user?.id);
    const queued = chains.filter(c => c.status === 'active' && c.started_by !== user?.id && c.current_holder !== user?.id);
    const ended = chains.filter(c => c.status === 'broken' || c.status === 'ended');

    return { active, yourTurn, queued, ended };
  }, [chains, user?.id]);

  const tabCounts = {
    active: categorizedChains.active.length,
    yourTurn: categorizedChains.yourTurn.length,
    queued: categorizedChains.queued.length,
    ended: categorizedChains.ended.length,
  };

  const EmptyState = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <motion.div 
      className="flex flex-col items-center justify-center py-12 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      {activeTab === 'active' && onStartNewChain && (
        <Button 
          className="mt-4"
          onClick={onStartNewChain}
        >
          <Plus className="h-4 w-4 mr-2" />
          Start a Chain
        </Button>
      )}
    </motion.div>
  );

  const ChainList = ({ chains: chainList }: { chains: typeof chains }) => {
    if (chainList.length === 0) {
      const emptyStates = {
        active: { icon: Link2, title: 'No Active Chains', description: 'Start a new chain to spread kindness!' },
        yourTurn: { icon: Clock, title: 'No Chains Waiting', description: "You're all caught up! No chains need your attention." },
        queued: { icon: Inbox, title: 'No Queued Chains', description: 'Chains you participate in will appear here.' },
        ended: { icon: History, title: 'No Ended Chains', description: 'Completed and broken chains will appear here.' },
      };
      const state = emptyStates[activeTab as keyof typeof emptyStates] || emptyStates.active;
      return <EmptyState {...state} />;
    }

    return (
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {chainList.map((chain, index) => (
            <motion.div
              key={chain.chain_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <ChainCard 
                chain={chain}
                onShare={(id) => console.log('Share chain:', id)}
                onViewDetails={(id) => console.log('View details:', id)}
                onPause={(id) => console.log('Pause chain:', id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load chains</p>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-4">
          <TabsTrigger value="active" className="relative text-xs sm:text-sm">
            Active
            {tabCounts.active > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/20 text-primary rounded-full">
                {tabCounts.active}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="yourTurn" className="relative text-xs sm:text-sm">
            Your Turn
            {tabCounts.yourTurn > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-orange-500/20 text-orange-500 rounded-full animate-pulse">
                {tabCounts.yourTurn}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="queued" className="text-xs sm:text-sm">
            Queued
            {tabCounts.queued > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded-full">
                {tabCounts.queued}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ended" className="text-xs sm:text-sm">
            Ended
            {tabCounts.ended > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded-full">
                {tabCounts.ended}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[400px] pr-2">
          <TabsContent value="active" className="mt-0">
            <ChainList chains={categorizedChains.active} />
          </TabsContent>
          
          <TabsContent value="yourTurn" className="mt-0">
            <ChainList chains={categorizedChains.yourTurn} />
          </TabsContent>
          
          <TabsContent value="queued" className="mt-0">
            <ChainList chains={categorizedChains.queued} />
          </TabsContent>
          
          <TabsContent value="ended" className="mt-0">
            <ChainList chains={categorizedChains.ended} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default MentChainsSection;

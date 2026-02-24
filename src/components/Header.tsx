import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePauseTokens } from '@/hooks/usePauseTokens';
import unwrappedMint from '@/assets/unwrapped-mint.png';
import HowItWorksModal from './HowItWorksModal';
import AccountSettingsModal from './AccountSettingsModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Ticket } from 'lucide-react';

interface HeaderProps {
  worldCount: number;
}

const Header = ({ worldCount }: HeaderProps) => {
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { profile, user } = useAuth();
  const { pauseTokens, canClaimFreeToken } = usePauseTokens();
  const formattedCount = worldCount.toLocaleString();

  // Resilient display name: profile → user metadata → email local part → "U"
  const resolvedName = profile?.display_name
    || user?.user_metadata?.full_name
    || (user?.email ? user.email.split('@')[0] : null);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <img src={unwrappedMint} alt="Mint" className="h-10 w-10 object-contain" />
              <span className="font-display text-lg font-bold text-ring">
                The Ment Shop
              </span>
            </Link>
          </div>
          
          {/* Center Nav */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsHowItWorksOpen(true)}
              className="font-display text-sm font-semibold text-foreground hover:text-primary transition-colors px-4 py-2 rounded-full hover:bg-primary/10"
            >
              How it works
            </motion.button>
            
            <Link to="/store">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex items-center gap-1.5 font-display text-sm font-semibold text-foreground hover:text-primary transition-colors px-4 py-2 rounded-full hover:bg-primary/10"
              >
                <Ticket className="h-4 w-4" />
                <span className="hidden sm:inline">Store</span>
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {pauseTokens}
                </span>
                {canClaimFreeToken && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                )}
              </motion.div>
            </Link>
          </nav>
          
          <div className="flex items-center gap-4">
            {/* World Counter */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="world-tracker flex items-center gap-2 rounded-full px-4 py-2 text-mint-light"
            >
              <motion.span
                className="text-2xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                🌍
              </motion.span>
              <motion.span
                key={worldCount}
                initial={{ scale: 1.2, color: '#FFD740' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                className="font-display font-bold"
              >
                {formattedCount}
              </motion.span>
            </motion.div>

            {/* User Avatar - Clickable for Settings */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSettingsOpen(true)}
              className="relative flex items-center gap-2 group"
            >
              <Avatar className="h-9 w-9 border-2 border-mint transition-colors group-hover:border-primary">
                <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-mint text-primary-foreground font-display">
                  {getInitials(resolvedName)}
                </AvatarFallback>
              </Avatar>
              {/* Settings icon overlay on hover */}
              <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Settings className="h-4 w-4 text-primary" />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </header>

      <HowItWorksModal 
        isOpen={isHowItWorksOpen} 
        onClose={() => setIsHowItWorksOpen(false)} 
      />

      <AccountSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};

export default Header;

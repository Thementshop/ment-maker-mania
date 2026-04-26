import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import unwrappedMint from '@/assets/unwrapped-mint.png';
import HowItWorksModal from './HowItWorksModal';
import AccountSettingsModal from './AccountSettingsModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings } from 'lucide-react';

interface HeaderProps {
  worldCount: number;
}

const Header = ({ worldCount }: HeaderProps) => {
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { profile, user } = useAuth();
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
        {/* Desktop layout (md and up) — unchanged */}
        <div className="container hidden md:flex h-16 items-center justify-between">
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
          </nav>

          <div className="flex items-center gap-4">
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

        {/* Mobile layout (below md) — rigid two-row stack for narrow iPhones */}
        <div className="container md:hidden flex flex-col gap-2 py-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-2 pr-2">
              <img src={unwrappedMint} alt="Mint" className="h-8 w-8 shrink-0 object-contain" />
              <span className="truncate whitespace-nowrap font-display text-[15px] font-bold leading-tight text-ring">
                The Ment Shop
              </span>
            </Link>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSettingsOpen(true)}
              className="relative shrink-0"
              aria-label="Open account settings"
            >
              <Avatar className="h-9 w-9 border-2 border-mint">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-mint text-primary-foreground font-display">
                  {getInitials(resolvedName)}
                </AvatarFallback>
              </Avatar>
            </motion.button>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsHowItWorksOpen(true)}
              className="justify-self-start rounded-full px-2.5 py-1.5 font-display text-[11px] font-semibold leading-none text-foreground transition-colors hover:bg-primary/10"
            >
              How it works
            </motion.button>

            <motion.div
              whileTap={{ scale: 0.98 }}
              className="world-tracker inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-mint-light"
              aria-label={`World Kindness Tracker ${formattedCount}`}
            >
              <motion.span
                className="text-base leading-none"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                🌍
              </motion.span>
              <motion.span
                key={worldCount}
                initial={{ scale: 1.2, color: '#FFD740' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                className="font-display text-xs font-bold leading-none tabular-nums sm:text-sm"
              >
                {formattedCount}
              </motion.span>
            </motion.div>
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

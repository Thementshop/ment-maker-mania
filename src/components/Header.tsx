import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import mentShopLogo from '@/assets/ment-shop-logo.png';
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
    return name.split('').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <header className="site-header sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        {/* Desktop layout (md and up) */}
        <div className="header-desktop-layout container relative hidden h-24 items-center justify-between md:flex">
          <Link to="/" className="flex items-center gap-2" aria-label="The Ment Shop home">
            <img src={mentShopLogo} alt="The Ment Shop" className="h-20 w-auto object-contain" />
          </Link>

          {/* Center: World Kindness Tracker */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="world-tracker absolute left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-mint-light"
          >
            <motion.span
              className="text-2xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            > </motion.span>
            <motion.span
              key={worldCount}
              initial={{ scale: 1.2, color: '#FFD740' }}
              animate={{ scale: 1, color: '#FFFFFF' }}
              className="font-display font-bold"
            >
              {formattedCount}
            </motion.span>
          </motion.div>

          {/* Right: Avatar with "How It Works" centered below */}
          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSettingsOpen(true)}
              className="relative flex items-center group"
              aria-label="Open account settings"
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

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsHowItWorksOpen(true)}
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-center text-xs font-semibold font-display text-foreground hover:text-primary transition-colors"
            >
              How It Works
            </motion.button>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden w-full overflow-hidden px-3 py-2">
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
            {/* Left: Logo (2x size) */}
            <Link
              to="/"
              className="flex shrink-0 items-center"
              aria-label="The Ment Shop home"
            >
              <img src={mentShopLogo} alt="The Ment Shop" className="h-20 w-auto object-contain" />
            </Link>

            {/* Center: World Kindness Tracker */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex shrink-0 items-center justify-self-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 world-tracker"
              aria-label={`World Kindness Tracker ${formattedCount}`}
            >
              <motion.span
                className="text-base leading-none"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              > </motion.span>
              <motion.span
                key={worldCount}
                initial={{ scale: 1.2, color: '#FFD740' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                className="text-sm leading-none font-bold font-display tabular-nums"
              >
                {formattedCount}
              </motion.span>
            </motion.div>

            {/* Right: Avatar with "How It Works" centered below */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSettingsOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center"
                aria-label="Open account settings"
              >
                <Avatar className="h-9 w-9 shrink-0 border-2 border-mint">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-mint font-display text-primary-foreground">
                    {getInitials(resolvedName)}
                  </AvatarFallback>
                </Avatar>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsHowItWorksOpen(true)}
                className="whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[12px] leading-none font-semibold text-foreground font-display hover:text-primary"
              >
                How It Works
              </motion.button>
            </div>
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

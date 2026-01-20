import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import unwrappedMint from '@/assets/unwrapped-mint.png';
import HowItWorksModal from './HowItWorksModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  worldCount: number;
}

const Header = ({ worldCount }: HeaderProps) => {
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const { profile } = useAuth();
  const formattedCount = worldCount.toLocaleString();

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={unwrappedMint} alt="Mint" className="h-10 w-10 object-contain" />
            <span className="font-display text-lg font-bold text-ring">
              The Ment Shop
            </span>
          </div>
          
          {/* Center Nav */}
          <nav className="absolute left-1/2 -translate-x-1/2">
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

            {/* User Avatar */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2"
            >
              <Avatar className="h-9 w-9 border-2 border-mint">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-mint text-primary-foreground font-display">
                  {getInitials(profile?.display_name)}
                </AvatarFallback>
              </Avatar>
            </motion.div>
          </div>
        </div>
      </header>

      <HowItWorksModal 
        isOpen={isHowItWorksOpen} 
        onClose={() => setIsHowItWorksOpen(false)} 
      />
    </>
  );
};

export default Header;

import { motion } from 'framer-motion';
import logo from '@/assets/logo.png';
import unwrappedMint from '@/assets/unwrapped-mint.png';
interface HeaderProps {
  worldCount: number;
}
const Header = ({
  worldCount
}: HeaderProps) => {
  const formattedCount = worldCount.toLocaleString();
  return <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={unwrappedMint} alt="Mint" className="h-10 w-10 object-contain" />
          <span className="font-display text-lg font-bold text-ring">
            The Ment Shop
          </span>
        </div>
        
        <motion.div whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }} className="world-tracker flex items-center gap-2 rounded-full px-4 py-2 text-mint-light">
          <motion.span className="text-2xl" animate={{
          rotate: 360
        }} transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}>
            🌍
          </motion.span>
          <motion.span key={worldCount} initial={{
          scale: 1.2,
          color: '#FFD740'
        }} animate={{
          scale: 1,
          color: '#FFFFFF'
        }} className="font-display font-bold">
            {formattedCount}
          </motion.span>
        </motion.div>
      </div>
    </header>;
};
export default Header;
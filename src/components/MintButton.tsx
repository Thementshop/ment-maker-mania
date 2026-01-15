import { motion } from 'framer-motion';
import wrappedMint from '@/assets/wrapped-mint.png';
interface MintButtonProps {
  onClick: () => void;
}
const MintButton = ({
  onClick
}: MintButtonProps) => {
  return <div className="relative flex-col mx-[50px] flex items-center justify-center">
      
      <motion.button onClick={onClick} className="relative flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-mint/50 rounded-full w-40 h-40" whileHover={{
      scale: 1.05
    }} whileTap={{
      scale: 0.95
    }} animate={{
      scale: [1, 1.02, 1]
    }} transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }}>
        <motion.img src={wrappedMint} alt="Send a Ment" className="w-40 h-40 object-contain mx-auto" animate={{
        filter: ['drop-shadow(0 0 20px rgba(46, 204, 113, 0.6)) drop-shadow(0 0 40px rgba(46, 204, 113, 0.4))', 'drop-shadow(0 0 35px rgba(46, 204, 113, 0.9)) drop-shadow(0 0 60px rgba(46, 204, 113, 0.6))', 'drop-shadow(0 0 20px rgba(46, 204, 113, 0.6)) drop-shadow(0 0 40px rgba(46, 204, 113, 0.4))'],
        scale: [1, 1.05, 1]
      }} transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }} />
      </motion.button>
      
      <motion.p className="mt-4 font-display text-xl font-bold text-mint" animate={{
      opacity: [0.8, 1, 0.8]
    }} transition={{
      duration: 2,
      repeat: Infinity
    }}> SEND A MENT</motion.p>
    </div>;
};
export default MintButton;
import { motion } from 'framer-motion';
import wrappedMint from '@/assets/wrapped-mint.png';
interface MintButtonProps {
  onClick: () => void;
}
const MintButton = ({
  onClick
}: MintButtonProps) => {
  return <div className="relative flex flex-col items-center">
      {/* Pulse ring behind button */}
      <motion.div className="absolute inset-0 rounded-full bg-mint/30" animate={{
      scale: [1, 1.2, 1],
      opacity: [0.5, 0, 0.5]
    }} transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }} style={{
      width: 160,
      height: 160,
      left: '50%',
      top: '50%',
      marginLeft: -80,
      marginTop: -80
    }} />
      
      <motion.button onClick={onClick} className="relative flex flex-col items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-mint/50 rounded-full" whileHover={{
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
        <motion.img src={wrappedMint} alt="Send a Ment" className="w-40 h-40 object-contain drop-shadow-lg" style={{
        filter: 'drop-shadow(0 8px 24px rgba(46, 204, 113, 0.4))'
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
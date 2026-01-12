import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { inspirationalQuotes } from '@/data/compliments';

const InspirationalQuote = () => {
  const [quote, setQuote] = useState('');
  
  useEffect(() => {
    // Pick a random quote
    const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];
    setQuote(randomQuote);
    
    // Change quote every 10 seconds
    const interval = setInterval(() => {
      const newQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];
      setQuote(newQuote);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <motion.p
      key={quote}
      className="text-center text-sm italic text-muted-foreground px-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5 }}
    >
      "{quote}"
    </motion.p>
  );
};

export default InspirationalQuote;

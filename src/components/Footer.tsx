import { motion } from 'framer-motion';
import { Heart, Mail, Megaphone, Info } from 'lucide-react';
import unwrappedMint from '@/assets/unwrapped-mint.png';

const Footer = () => {
  return (
    <footer className="bg-card/80 backdrop-blur-sm border-t border-border/50 mt-auto">
      <div className="container py-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-lg text-foreground">About</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Ment Shop is the candy store of compliments! We're on a mission to spread kindness 
              across the world, one sweet ment at a time. Every compliment you send adds to our 
              global kindness counter and makes someone's day a little brighter. 🍬
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-candy-pink fill-candy-pink" />
              <span>for a kinder world</span>
            </div>
          </motion.div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-lg text-foreground">Contact</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Have questions, feedback, or just want to say hi? We'd love to hear from you!
            </p>
            <div className="space-y-2">
              <motion.a
                href="mailto:hello@thementshop.com"
                whileHover={{ scale: 1.02 }}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Mail className="w-4 h-4" />
                hello@thementshop.com
              </motion.a>
            </div>
          </motion.div>

          {/* Advertise Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-lg text-foreground">Advertise with Us</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Partner with The Ment Shop to reach our community of kindness enthusiasts. 
              Align your brand with positivity and make a meaningful impact together.
            </p>
            <motion.a
              href="mailto:ads@thementshop.com"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 
                         rounded-full text-sm font-semibold text-primary transition-colors"
            >
              <Megaphone className="w-4 h-4" />
              Get in touch
            </motion.a>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            <img src={unwrappedMint} alt="Mint" className="w-6 h-6 object-contain" />
            <span className="font-display text-sm font-bold text-muted-foreground">
              The Ment Shop
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} The Ment Shop. Spreading sweetness worldwide.
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;

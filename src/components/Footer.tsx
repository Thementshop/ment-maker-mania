import { motion } from 'framer-motion';
import { Heart, Mail, Megaphone, Info, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import unwrappedMint from '@/assets/unwrapped-mint.png';
import brandMint from '@/assets/brand-mint.png';

const Footer = () => {
  const [copied, setCopied] = useState<string | null>(null);

  const handleEmailClick = (email: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Try to open the user's mail client in a new tab so the preview iframe
    // doesn't try to load a webmail provider that refuses to be framed.
    const win = window.open(`mailto:${email}`, '_blank');
    // Always copy to clipboard as a reliable fallback.
    navigator.clipboard?.writeText(email).then(() => {
      setCopied(email);
      toast.success(`Copied ${email} to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
    // If the popup was blocked or nothing happens, the toast still confirms the copy.
    if (!win) e.preventDefault();
  };

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
            <p className="text-sm text-muted-foreground leading-relaxed flex flex-wrap items-center gap-1">
              The Ment Shop is the candy store of compliments! We're on a mission to spread kindness
              across the world, one sweet ment at a time. Every compliment you send adds to our
              global kindness counter and makes someone's day a little brighter.
              <img src={brandMint} alt="" className="inline-block h-4 w-4 object-contain align-middle" />
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
              <a
                href="mailto:hello@mentshop.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleEmailClick('hello@mentshop.com')}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                {copied === 'hello@mentshop.com' ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                hello@mentshop.com
              </a>
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
            <a
              href="mailto:info@mentshop.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleEmailClick('info@mentshop.com')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20
                         rounded-full text-sm font-semibold text-primary transition-colors hover:scale-[1.02] active:scale-[0.98]"
            >
              {copied === 'info@mentshop.com' ? <Check className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
              {copied === 'info@mentshop.com' ? 'Email copied!' : 'Get in touch'}
            </a>
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
          <div className="flex items-center gap-4 text-xs">
            <a href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy</a>
            <a href="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms</a>
            <a href="/sms-terms" className="text-muted-foreground hover:text-primary transition-colors">SMS Terms</a>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;

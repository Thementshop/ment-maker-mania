import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import revealVideo from '@/assets/reveal-video.mp4.asset.json';
import revealPoster from '@/assets/reveal-poster.jpg.asset.json';

/* ────────────────────────────────────────────────────────────────────────
   RevealAnimation
   A reusable reveal/unwrap screen. The compliment text animates as a layer
   ON TOP of the reveal video (no background of its own — the video shows
   through). Video plays once (no loop) and holds on its final frame.

   Timing (relative to video playback):
     3.9s → compliment begins (pinpoint → full size, fade + zoom + sharpen)
     ~5.8s → compliment fully settled
     6.4s → sender name fades in (if showSender)
   ──────────────────────────────────────────────────────────────────────── */

export interface RevealAnimationProps {
  /** The actual compliment text from the database. */
  complimentText: string;
  /** Compliment category id (drives font selection). */
  category: string;
  /** The sender's display name. */
  senderName: string;
  /** Whether to reveal the sender name (defaults to hidden later on). */
  showSender?: boolean;
  /** Optional className for the root container. */
  className?: string;
}

type FontKey = 'pacifico' | 'fredoka' | 'baloo' | 'caveat' | 'quicksand';

interface FontDef {
  /** CSS font-family stack. */
  stack: string;
  /** Exact family name for document.fonts.load. */
  name: string;
  /** Google Fonts family param. */
  param: string;
  /** Weight used for the compliment. */
  weight: number;
}

const FONTS: Record<FontKey, FontDef> = {
  pacifico: { stack: "'Pacifico', cursive", name: 'Pacifico', param: 'Pacifico', weight: 400 },
  fredoka: { stack: "'Fredoka', sans-serif", name: 'Fredoka', param: 'Fredoka:wght@400;500;600;700', weight: 600 },
  baloo: { stack: "'Baloo 2', cursive", name: 'Baloo 2', param: 'Baloo+2:wght@400;500;600;700', weight: 600 },
  caveat: { stack: "'Caveat', cursive", name: 'Caveat', param: 'Caveat:wght@400;700', weight: 700 },
  quicksand: { stack: "'Quicksand', sans-serif", name: 'Quicksand', param: 'Quicksand:wght@400;500;600;700', weight: 600 },
};

// Map compliment categories → emotional font category.
function fontKeyForCategory(category: string, isAllCaps: boolean): FontKey {
  const c = (category || '').toLowerCase();
  // Sympathy / Love → Pacifico, but Pacifico breaks in ALL CAPS → Quicksand.
  if (c === 'love' || c === 'sympathy') return isAllCaps ? 'quicksand' : 'pacifico';
  if (c === 'encouragement') return 'fredoka';
  if (c === 'special') return 'baloo';
  if (c === 'funny') return 'caveat';
  // affirmation / custom / default
  return 'quicksand';
}

// Scale font size down gracefully so long compliments fit within ~3 lines.
function complimentFontSize(len: number): string {
  if (len <= 24) return 'clamp(2.6rem, 11vw, 4.4rem)';
  if (len <= 50) return 'clamp(2.1rem, 9vw, 3.6rem)';
  if (len <= 90) return 'clamp(1.7rem, 7vw, 2.9rem)';
  if (len <= 140) return 'clamp(1.35rem, 5.6vw, 2.3rem)';
  return 'clamp(1.1rem, 4.6vw, 1.9rem)';
}

const TEXT_START = 3.9; // seconds into video
const SENDER_START = 6.4; // seconds into video

const RevealAnimation = ({
  complimentText,
  category,
  senderName,
  showSender = true,
  className = '',
}: RevealAnimationProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showText, setShowText] = useState(false);
  const [showSenderNow, setShowSenderNow] = useState(false);

  const text = (complimentText || '').trim();
  const isAllCaps = /[A-Z]/.test(text) && text === text.toUpperCase();
  const fontKey = fontKeyForCategory(category, isAllCaps);
  const font = FONTS[fontKey];

  // Funny/slang (Caveat) glow swallows the strokes → reduce glow blur ~30%.
  const glowScale = fontKey === 'caveat' ? 0.7 : 1;
  const fontSize = complimentFontSize(text.length);

  // ─── Preload ONLY the one needed font (no font flash at 3.9s) ───
  useEffect(() => {
    const id = `reveal-font-${fontKey}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${font.param}&display=swap`;
      document.head.appendChild(link);
    }
    // Warm the glyph cache so the very first paint at 3.9s is already crisp.
    if ('fonts' in document) {
      document.fonts.load(`${font.weight} 3rem '${font.name}'`, text).catch(() => {});
    }
  }, [fontKey, font.param, font.name, font.weight, text]);

  // ─── Start playback + drive reveal timing off the video clock ───
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const fallbackTimers: number[] = [];
    let textShown = false;
    let senderShown = false;
    let raf = 0;

    v.play().catch(() => {
      // Autoplay blocked (rare — we're mounted on a user tap). Surface the text
      // on a wall-clock fallback so the recipient never sees a frozen screen.
      const t1 = window.setTimeout(() => setShowText(true), TEXT_START * 1000);
      const t2 = window.setTimeout(() => setShowSenderNow(true), SENDER_START * 1000);
      fallbackTimers.push(t1, t2);
    });


    const tick = () => {
      const t = v.currentTime;
      if (!textShown && t >= TEXT_START) {
        textShown = true;
        setShowText(true);
      }
      if (!senderShown && t >= SENDER_START) {
        senderShown = true;
        setShowSenderNow(true);
      }
      if (!senderShown) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      fallbackTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Glossy neon-green glass finish: layered glow + definition.
  const textShadow = [
    '0 0 2px rgba(63,170,34,0.95)', // darker-green inner definition
    '0 1px 2px rgba(10,55,10,0.55)', // subtle depth
    `0 0 ${8 * glowScale}px rgba(88,252,89,0.95)`,
    `0 0 ${18 * glowScale}px rgba(88,252,89,0.75)`,
    `0 0 ${34 * glowScale}px rgba(88,252,89,0.55)`,
    `0 0 ${54 * glowScale}px rgba(88,252,89,0.32)`,
  ].join(', ');

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height: '100dvh', backgroundColor: '#eafff0' }}
    >
      {/* Reveal video — muted, inline, plays ONCE, holds final frame. */}
      <video
        ref={videoRef}
        src={revealVideo.url}
        poster={revealPoster.url}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Compliment layer — upper-middle band (~30–55% height), centered. */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex items-center justify-center px-6 text-center"
        style={{ top: '30%', height: '25%' }}
      >
        {showText && (
          <motion.h1
            initial={{ opacity: 0, scale: 0.04, y: '7.5vh', filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, y: '0vh', filter: 'blur(0px)' }}
            transition={{ duration: 1.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: font.stack,
              fontWeight: font.weight,
              fontSize,
              lineHeight: 1.12,
              letterSpacing: fontKey === 'caveat' ? '0.5px' : '0px',
              maxWidth: '92%',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              backgroundImage:
                'linear-gradient(180deg, #ffffff 0%, #dcffde 16%, #58fc59 44%, #58fc59 66%, #3FAA22 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              textShadow,
              willChange: 'transform, opacity, filter',
            }}
          >
            {text}
          </motion.h1>
        )}
      </div>

      {/* Sender name — below the compliment, solid darker green, little glow. */}
      {showSender && (
        <div
          className="pointer-events-none absolute left-0 right-0 flex items-start justify-center px-6 text-center"
          style={{ top: '57%' }}
        >
          {showSenderNow && senderName && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 'clamp(1rem, 4.5vw, 1.6rem)',
                color: '#3FAA22',
                textShadow: '0 0 6px rgba(88,252,89,0.25)',
                willChange: 'transform, opacity',
              }}
            >
              — {senderName}
            </motion.p>
          )}
        </div>
      )}
    </div>
  );
};

export default RevealAnimation;

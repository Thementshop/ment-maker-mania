import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import revealVideo from '@/assets/reveal-video.mp4.asset.json';
import revealPoster from '@/assets/reveal-poster.jpg.asset.json';

/* ────────────────────────────────────────────────────────────────────────
   RevealAnimation
   A reusable reveal/unwrap screen. The compliment text animates as a layer
   ON TOP of the reveal video (no background of its own — the video shows
   through). Video plays once (no loop) and holds on its final frame.

   Motion:
     3.9s → compliment begins as a tiny pinpoint at the EXACT screen center
            (over the mint/burst), then zooms forward AND drifts up to settle
            in the upper-middle band (~40% of screen height).
     6.4s → sender name fades in, reserved BELOW the full compliment block
            (never overlaps, for 1/2/3-line compliments).
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

// Fallback font size (used only until the auto-fitter measures the real text).
function fallbackFontSize(len: number): string {
  if (len <= 24) return 'clamp(2.6rem, 11vw, 4.4rem)';
  if (len <= 50) return 'clamp(2.1rem, 9vw, 3.6rem)';
  if (len <= 90) return 'clamp(1.7rem, 7vw, 2.9rem)';
  if (len <= 140) return 'clamp(1.35rem, 5.6vw, 2.3rem)';
  return 'clamp(1.1rem, 4.6vw, 1.9rem)';
}

const TEXT_START = 3.9; // seconds into video
const SENDER_START = 6.4; // seconds into video
const LINE_HEIGHT = 1.35;
const MAX_LINES = 3;
const MIN_FONT_PX = 16; // readability floor
const DRIFT_VH = 10; // pinpoint at center (+10vh) → settles in upper-middle (−10vh = ~40%)

// Keep the last two words together so a single word never sits alone on the
// final line (orphan prevention). Works for any DB text, automatically.
function preventOrphans(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return text;
  return words.slice(0, -1).join(' ') + '\u00A0' + words[words.length - 1];
}

// Measure how many lines the text wraps to at a given size, then binary-search
// the LARGEST font size that fits within MAX_LINES. Larger for short text,
// smaller for long — all automatic, floored at MIN_FONT_PX.
function fitFontSize(
  text: string,
  fontStack: string,
  weight: number,
  maxWidthPx: number,
  maxPx: number,
  minPx: number,
): number {
  if (typeof document === 'undefined' || maxWidthPx <= 0) return maxPx;

  const meas = document.createElement('div');
  Object.assign(meas.style, {
    position: 'absolute',
    visibility: 'hidden',
    left: '-9999px',
    top: '0',
    width: `${maxWidthPx}px`,
    fontFamily: fontStack,
    fontWeight: String(weight),
    lineHeight: String(LINE_HEIGHT),
    whiteSpace: 'normal',
    wordBreak: 'normal',
    textWrap: 'balance',
    textAlign: 'center',
  } as CSSStyleDeclaration);
  meas.textContent = text;
  document.body.appendChild(meas);

  const lineCountAt = (px: number): number => {
    meas.style.fontSize = `${px}px`;
    return Math.max(1, Math.round(meas.scrollHeight / (px * LINE_HEIGHT)));
  };

  let lo = minPx;
  let hi = maxPx;
  let best = minPx;
  for (let i = 0; i < 14 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (lineCountAt(mid) <= MAX_LINES) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  document.body.removeChild(meas);
  return Math.max(minPx, Math.round(best));
}

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
  const [fontSizePx, setFontSizePx] = useState<number | null>(null);
  const [isWide, setIsWide] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const text = (complimentText || '').trim();
  const displayText = preventOrphans(text);
  const isAllCaps = /[A-Z]/.test(text) && text === text.toUpperCase();
  const fontKey = fontKeyForCategory(category, isAllCaps);
  const font = FONTS[fontKey];

  // Funny/slang (Caveat) glow swallows the strokes → reduce glow blur ~30%.
  const glowScale = fontKey === 'caveat' ? 0.7 : 1;

  // ─── Respect prefers-reduced-motion ───
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    if ('fonts' in document) {
      document.fonts.load(`${font.weight} 3rem '${font.name}'`, text).catch(() => {});
    }
  }, [fontKey, font.param, font.name, font.weight, text]);

  // ─── Auto font-fit to ≤3 lines (waits for the font, recomputes on resize) ───
  useLayoutEffect(() => {
    let cancelled = false;

    const compute = () => {
      const vw = window.innerWidth;
      // Text column is 92% wide, capped; subtract px-6 (24px each side) padding.
      const maxWidth = Math.min(vw * 0.92, 680) - 48;
      const maxPx = Math.min(vw * 0.14, 76);
      const size = fitFontSize(displayText, font.stack, font.weight, maxWidth, maxPx, MIN_FONT_PX);
      if (!cancelled) setFontSizePx(size);
    };

    if ('fonts' in document) {
      document.fonts
        .load(`${font.weight} 3rem '${font.name}'`, displayText)
        .then(() => !cancelled && compute())
        .catch(() => !cancelled && compute());
    } else {
      compute();
    }

    window.addEventListener('resize', compute);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', compute);
    };
  }, [displayText, font.stack, font.weight, font.name]);

  // ─── Detect wide/landscape vs. portrait for video fit (cover vs. contain) ───
  useEffect(() => {
    // Video is portrait 9:16 (~0.5625). When the viewport is at least this wide
    // relative to its height, object-cover would zoom/crop the mint → use contain.
    const mq = window.matchMedia('(min-aspect-ratio: 9 / 16)');
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // ─── Start playback + drive reveal timing off the video clock ───
  useEffect(() => {
    if (prefersReducedMotion) {
      setShowText(true);
      setShowSenderNow(true);
      return;
    }
    const v = videoRef.current;
    if (!v) return;

    const fallbackTimers: number[] = [];
    let textShown = false;
    let senderShown = false;
    let raf = 0;

    v.play().catch(() => {
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
  }, [prefersReducedMotion]);

  // Punchy neon-green glass finish: deeper green core for contrast against the
  // bright near-white background, stronger dark inner edges for crisp definition,
  // bright specular highlight, and a confident outer glow.
  const textShadow = [
    // Deep dark-green edge shadow for maximum contrast and crisp letterforms.
    '0 0 1px rgba(12,60,4,0.98)',
    '0 0 2px rgba(18,90,8,0.90)',
    '0 0 3px rgba(24,120,12,0.80)',
    // Mid-green inner glow for depth.
    '0 0 4px rgba(47,143,23,0.95)',
    '0 0 6px rgba(63,170,34,0.85)',
    // Crisp bright white-green specular highlight along the top edge (glossy wet look).
    '0 -1px 1px rgba(220,255,220,0.95)',
    '0 -2px 2px rgba(200,255,200,0.60)',
    // Confident neon outer glow — hugs the letters without haze.
    `0 0 ${3 * glowScale}px rgba(88,252,89,0.85)`,
    `0 0 ${6 * glowScale}px rgba(88,252,89,0.55)`,
    `0 0 ${10 * glowScale}px rgba(63,170,34,0.35)`,
  ].join(', ');

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height: '100dvh', backgroundColor: '#f7f7f7' }}
    >
      {/* Reveal video — muted, inline, plays ONCE, holds final frame.
          Portrait/mobile → cover (fills screen). Wide → contain (whole mint
          visible, centered, soft near-white fill on the sides, no gray seam).
          Subtle brightness/contrast lift (no blur → smooth playback). */}
      <video
        ref={videoRef}
        src={revealVideo.url}
        poster={revealPoster.url}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: isWide ? 'contain' : 'cover',
          objectPosition: 'center',
          filter: 'brightness(1.28) contrast(1.04)',
        }}
      />

      {/* Compliment + sender column — vertically centered, then lifted into the
          upper-middle band. The pinpoint starts at TRUE screen center and zooms
          forward/up. Sender space is reserved beneath the full compliment box. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div
          className="flex flex-col items-center"
          style={{ transform: `translateY(-${DRIFT_VH}vh)`, maxWidth: '92%' }}
        >
          {showText && (
            <motion.h1
              initial={
                prefersReducedMotion
                  ? { opacity: 1, scale: 1, y: '0vh', filter: 'blur(0px)' }
                  : { opacity: 0, scale: 0.04, y: `${DRIFT_VH}vh`, filter: 'blur(14px)' }
              }
              animate={{ opacity: 1, scale: 1, y: '0vh', filter: 'blur(0px)' }}
              transition={{ duration: prefersReducedMotion ? 0 : 1.9, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'relative',
                fontFamily: font.stack,
                fontWeight: font.weight,
                fontSize: fontSizePx ? `${fontSizePx}px` : fallbackFontSize(text.length),
                lineHeight: LINE_HEIGHT,
                letterSpacing: fontKey === 'caveat' ? '0.5px' : '0px',
                textWrap: 'balance',
                wordBreak: 'normal',
                padding: '0.6em 0',
                overflow: 'visible',
                color: '#2ee82e',
                textShadow,
                willChange: 'transform, opacity, filter',
              }}
            >
              {displayText}
            </motion.h1>
          )}

          {/* Sender — always mounted (reserves its space) so it never reflows
              into / overlaps the compliment when it fades in. */}
          {showSender && senderName && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={showSenderNow ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{
                marginTop: '0.9em',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 'clamp(1rem, 4.5vw, 1.6rem)',
                color: '#2ba61e',
                textShadow: '0 0 6px rgba(88,252,89,0.35)',
                willChange: 'transform, opacity',
              }}
            >
              — {senderName}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RevealAnimation;
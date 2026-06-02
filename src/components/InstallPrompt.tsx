import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Share, Plus, MoreVertical } from "lucide-react";
import brandMint from "@/assets/brand-mint.png";

const DISMISS_KEY = "tms-a2hs-dismissed-at";
const DISMISS_DAYS = 30;

// Minimal typing for the non-standard beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  // iOS Safari exposes navigator.standalone
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

type Platform = "ios-safari" | "ios-other" | "android" | "unsupported";

const detectPlatform = (): Platform => {
  const ua = window.navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(ua) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  if (isIos) {
    // Chrome (CriOS), Edge (EdgiOS), Firefox (FxiOS) etc. expose their own
    // tokens; anything else on iOS is the Safari engine.
    const isOtherIosBrowser = /crios|edgios|fxios|opt\//i.test(ua);
    return isOtherIosBrowser ? "ios-other" : "ios-safari";
  }

  if (/android/i.test(ua)) return "android";

  return "unsupported";
};

const wasRecentlyDismissed = () => {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  const ageMs = Date.now() - dismissedAt;
  return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already installed → never nudge.
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;

    const detected = detectPlatform();
    setPlatform(detected);

    // Android / Chromium — capture the native install prompt for a one-tap button.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Show on any platform we have real instructions for.
    if (detected !== "unsupported") setShow(true);

    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferredPrompt(null);
    setShow(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-xl backdrop-blur-md">
            <img
              src={brandMint}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain"
            />

            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-foreground">
                Want a little kindness one tap away?
              </p>

              {/* Android with native prompt available → delightful one-tap button */}
              {platform === "android" && deferredPrompt ? (
                <>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pop The Ment Shop on your home screen so a sweet moment is
                    always within reach. Totally optional — only if you'd like.
                  </p>
                  <button
                    onClick={handleAndroidInstall}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-display text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add The Ment Shop
                  </button>
                </>
              ) : platform === "android" ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Here's how to add us: tap the three-dot menu{" "}
                  <MoreVertical className="inline h-3.5 w-3.5 -translate-y-0.5 text-primary" />{" "}
                  in the top corner, then{" "}
                  <span className="font-semibold text-foreground">
                    "Add to Home Screen"
                  </span>{" "}
                  or{" "}
                  <span className="font-semibold text-foreground">
                    "Install app."
                  </span>{" "}
                  Sweet. 💚
                </p>
              ) : platform === "ios-other" ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Here's how to add us: tap the Share icon{" "}
                  <Share className="inline h-3.5 w-3.5 -translate-y-0.5 text-primary" />{" "}
                  in the address bar at the top, then{" "}
                  <span className="font-semibold text-foreground">
                    "Add to Home Screen."
                  </span>{" "}
                  Sweet. 💚
                </p>
              ) : (
                // iOS Safari (default)
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Here's how to add us: tap the Share icon{" "}
                  <Share className="inline h-3.5 w-3.5 -translate-y-0.5 text-primary" />{" "}
                  at the bottom of the screen, then{" "}
                  <span className="font-semibold text-foreground">
                    "Add to Home Screen."
                  </span>{" "}
                  Sweet. 💚
                </p>
              )}
            </div>

            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;

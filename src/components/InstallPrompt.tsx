import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Share, Plus } from "lucide-react";
import brandMint from "@/assets/brand-mint.png";

const DISMISS_KEY = "tms-a2hs-dismissed";

// Minimal typing for the non-standard beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  // iOS Safari exposes navigator.standalone
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
  !(window as unknown as { MSStream?: unknown }).MSStream;

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Android / Chrome — capture the install prompt for a custom button.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari has no install event — show a gentle instructional banner.
    if (isIos()) {
      setShowIosHint(true);
    }

    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferredPrompt(null);
    setShowIosHint(false);
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

  const visible = Boolean(deferredPrompt) || showIosHint;

  return (
    <AnimatePresence>
      {visible && (
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
                Keep a little kindness one tap away
              </p>

              {deferredPrompt ? (
                <>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add The Ment Shop to your home screen so a sweet moment is
                    always within reach.
                  </p>
                  <button
                    onClick={handleAndroidInstall}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-display text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add The Ment Shop
                  </button>
                </>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pop us on your home screen: tap{" "}
                  <Share className="inline h-3.5 w-3.5 -translate-y-0.5 text-primary" />{" "}
                  <span className="font-semibold text-foreground">Share</span>,
                  then{" "}
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

/**
 * Service worker registration with strict guards.
 *
 * Service workers must NEVER run inside the Lovable editor preview or an
 * iframe — they cache aggressively and break live reload + routing. So we:
 *   - unregister any existing SW when inside a preview host or iframe
 *   - only register on real production origins
 */

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access blocked => assume iframe
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.dev") ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewHost || isInIframe) {
    // Clean up any SW that may have been registered in a previous context.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((r) => r.unregister()))
      .catch(() => undefined);
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

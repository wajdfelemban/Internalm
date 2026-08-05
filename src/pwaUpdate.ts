import { registerSW } from "virtual:pwa-register";

/**
 * Registers the Workbox service worker so the app shell (JS/CSS/HTML) loads
 * offline — local IndexedDB data alone doesn't help if the browser can't
 * even fetch index.html without a network request. `registerType: 'prompt'`
 * (see vite.config.ts) means updates don't force-reload mid-session; we
 * prompt instead.
 */
export function initPwaUpdatePrompt(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      const shouldUpdate = window.confirm(
        "A new version of Recall is available. Reload to update?",
      );
      if (shouldUpdate) updateSW(true);
    },
    onOfflineReady() {
      console.info("Recall is ready to work offline.");
    },
  });
}

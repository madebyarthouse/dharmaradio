type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let registration: ServiceWorkerRegistration | null = null;
let installPrompt: InstallPromptEvent | null = null;
let updateAvailable = false;
let applyingUpdate = false;
const listeners = new Set<() => void>();
export const subscribePwa = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  for (const listener of listeners) listener();
};
export const getUpdateAvailable = () => updateAvailable;
export const getCanInstall = () => installPrompt !== null;
export function applyUpdate() {
  if (!registration?.waiting) return;
  applyingUpdate = true;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}
export async function promptInstall(): Promise<void> {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null;
  notify();
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch (error) {
    console.warn("Install prompt unavailable", error);
  }
}
export function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}
export function isIos() {
  return (
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
  );
}
let initialized = false;
export function initializePwa() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    notify();
  });
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", notify);
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    updateAvailable = false;
    notify();
    if (applyingUpdate) {
      applyingUpdate = false;
      window.location.reload();
    }
  });
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((reg) => {
      registration = reg;
      const check = () => {
        updateAvailable = !!reg.waiting && !!navigator.serviceWorker.controller;
        notify();
      };
      check();
      reg.addEventListener("updatefound", () => {
        reg.installing?.addEventListener("statechange", check);
      });
      // Long listening sessions should still discover releases without reloading.
      const update = () => {
        if (document.visibilityState === "visible")
          void reg.update().catch(() => undefined);
      };
      document.addEventListener("visibilitychange", update);
      window.addEventListener("online", update);
    })
    .catch((error) =>
      console.warn("Offline support could not be registered", error),
    );
}

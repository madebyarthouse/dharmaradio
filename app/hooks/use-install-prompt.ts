import { useSyncExternalStore } from "react";
import {
  getCanInstall,
  isIos,
  isStandalone,
  promptInstall,
  subscribePwa,
} from "~/pwa/client";
export function useInstallPrompt() {
  const standalone = useSyncExternalStore(
    subscribePwa,
    isStandalone,
    () => false,
  );
  return {
    canInstall:
      useSyncExternalStore(subscribePwa, getCanInstall, () => false) &&
      !standalone,
    promptInstall,
    isIos: useSyncExternalStore(subscribePwa, isIos, () => false),
    isStandalone: standalone,
  };
}

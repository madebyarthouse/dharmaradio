import { useSyncExternalStore } from "react";
import { applyUpdate, getUpdateAvailable, subscribePwa } from "~/pwa/client";
export function usePwaUpdate() {
  return {
    updateAvailable: useSyncExternalStore(
      subscribePwa,
      getUpdateAvailable,
      () => false,
    ),
    applyUpdate,
  };
}

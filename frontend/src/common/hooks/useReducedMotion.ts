import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const available = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";
function subscribe(listener: () => void) {
  if (!available()) return () => {};
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** Prefer static feedback when motion preferences cannot be read. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => !available() || window.matchMedia(query).matches,
    () => true,
  );
}

import { useSyncExternalStore } from "react";

/** Keep the JS navigation mode aligned with Tailwind's md breakpoint. */
export const MOBILE_QUERY = "(max-width: 767px)";
const getSnapshot = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia(MOBILE_QUERY).matches;
const getServerSnapshot = () => false;
function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

import { useEffect, useRef, useState } from "react";
import { authStorage } from "@/features/auth/utils/authStorage";

/** UI lock and local-response fence; network/session coordination remains in the API layer. */
export function useSessionFormSubmission() {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(work: (isCurrent: () => boolean) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const revision = authStorage.getRevision();
    const isCurrent = () =>
      mounted.current &&
      revision === authStorage.getRevision() &&
      !authStorage.isLoggingOut();
    try {
      await work(isCurrent);
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { pending, inFlight, mounted, run };
}

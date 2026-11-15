import { useEffect, useRef, useState } from "react";
import { authStorage } from "@/features/auth/utils/authStorage";

/** Lock synchronously, including validation, and fence local feedback to the original editor/login. */
export function useMemberBatchSubmission(
  onPendingChange?: (pending: boolean) => void,
) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function run(work: (isCurrent: () => boolean) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    onPendingChange?.(true);
    const revision = authStorage.getRevision();
    const isCurrent = () =>
      active.current &&
      revision === authStorage.getRevision() &&
      !authStorage.isLoggingOut();
    try {
      await work(isCurrent);
    } finally {
      inFlight.current = false;
      if (active.current) {
        setPending(false);
        onPendingChange?.(false);
      }
    }
  }
  return { pending, inFlight, run };
}

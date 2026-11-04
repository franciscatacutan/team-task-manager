import { useEffect, useRef } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Root recovery must render after router, query and authentication providers have unmounted. */
export default function CrashRecovery() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/20 px-4 py-8 sm:px-6">
      <section
        aria-labelledby="crash-recovery-heading"
        className="w-full max-w-md rounded-3xl border border-border/60 bg-background p-6 shadow-sm sm:p-8"
      >
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
        >
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1
          ref={heading}
          id="crash-recovery-heading"
          tabIndex={-1}
          className="mt-6 text-center text-2xl font-semibold tracking-tight text-foreground outline-none"
        >
          Something went wrong
        </h1>
        <p
          role="alert"
          className="mt-3 text-center text-sm leading-6 text-foreground/75"
        >
          The application couldn’t display this page. Reload to try again or
          open your workspace.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="h-10 rounded-xl sm:flex-1"
            onClick={() => window.location.reload()}
          >
            <RefreshCw aria-hidden="true" />
            Reload
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-xl sm:flex-1"
          >
            <a href="/teams">Open workspace</a>
          </Button>
        </div>
      </section>
    </main>
  );
}

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

export default function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-6">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-background p-8 shadow-sm">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
            <AlertTriangle className="h-8 w-8" />
          </div>
        </div>

        <div className="mt-6 space-y-3 text-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Something went wrong
            </h1>

            <p className="text-sm leading-6 text-muted-foreground">
              An unexpected error occurred while loading this page. Please try
              again or return to your workspace.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => navigate(-1)}
          >
            Go back
          </Button>

          <Button
            className="flex-1 rounded-xl"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

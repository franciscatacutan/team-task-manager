import { useNavigate } from "react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-background p-8 shadow-sm">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Unable to access workspace
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            You may no longer have access to this workspace, or the workspace
            may not exist.
          </p>
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
            onClick={() => navigate("/teams")}
          >
            Back to teams
          </Button>
        </div>
      </div>
    </div>
  );
}

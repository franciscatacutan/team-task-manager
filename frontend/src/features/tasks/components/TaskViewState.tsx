import { Button } from "@/components/ui/button";
import QueryFailure from "@/common/components/QueryFailure";

interface Props {
  state: "invalid" | "loading" | "unavailable" | "error";
  onRetry?: () => unknown;
  retrying?: boolean;
}
export default function TaskViewState({
  state,
  onRetry,
  retrying = false,
}: Props) {
  if (state === "loading")
    return (
      <div className="p-6" role="status">
        Loading task...
      </div>
    );
  if (state === "error" && onRetry)
    return (
      <div className="p-6">
        <QueryFailure label="task" onRetry={onRetry} pending={retrying} />
      </div>
    );
  return (
    <div className="space-y-3 p-6" role="alert">
      <h2 className="font-semibold">
        {state === "invalid" ? "Invalid task" : "Task unavailable"}
      </h2>
      <p>
        {state === "invalid"
          ? "Check the task link and try again."
          : "It may not exist or you may not have access."}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          disabled={retrying}
          onClick={() => {
            void onRetry();
          }}
        >
          {retrying ? "Retrying..." : "Retry"}
        </Button>
      )}
    </div>
  );
}

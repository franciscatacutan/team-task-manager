import { Button } from "@/components/ui/button";
export default function QueryFailure({
  label,
  onRetry,
  pending = false,
}: {
  label: string;
  onRetry: () => unknown;
  pending?: boolean;
}) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-xl border border-destructive/30 p-5 text-sm"
    >
      <p>Unable to load {label}. Please try again.</p>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          void onRetry();
        }}
      >
        {pending ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
}

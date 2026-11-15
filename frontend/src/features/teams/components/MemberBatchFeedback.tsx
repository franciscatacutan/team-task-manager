import type { MemberBatchResult } from "../types/team.type";

export default function MemberBatchFeedback({
  result,
  labels,
  error,
  verb,
}: {
  result: MemberBatchResult<unknown> | null;
  labels: Record<string, string>;
  error: string;
  verb: "Added" | "Removed";
}) {
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div
          role={result.failed.length ? "alert" : "status"}
          className="space-y-2 rounded-lg border p-3 text-sm"
        >
          <p>
            {verb} {result.success.length} member
            {result.success.length === 1 ? "" : "s"}. {result.failed.length}{" "}
            failed.
          </p>
          {result.failed.length > 0 && (
            <>
              <p>
                Successful changes are saved. Only unsuccessful selections
                remain for retry.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {result.failed.map((member) => (
                  <li key={member.userId}>
                    <span className="font-medium">
                      {labels[member.userId] ?? member.userId}
                    </span>
                    : {member.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}

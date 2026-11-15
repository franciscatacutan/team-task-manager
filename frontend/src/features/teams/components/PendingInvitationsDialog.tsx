import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionFormSubmission } from "@/common/hooks/useSessionFormSubmission";
import { queryKeys } from "@/common/query/queryKeys";
import { requestError } from "@/common/utils/requestError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getPendingTeamInvitations,
  revokeTeamInvitation,
  type PendingTeamInvitation,
} from "../api/teamMemberApi";

export default function PendingInvitationsDialog({
  teamKey,
}: {
  teamKey: string;
}) {
  const [open, setOpen] = useState(false);
  const submission = useSessionFormSubmission();

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!submission.inFlight.current) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          Pending invites
        </Button>
      </DialogTrigger>
      <DialogContent
        closeDisabled={submission.pending}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader className="pr-8">
          <DialogTitle>Pending invites</DialogTitle>
          <DialogDescription>
            Review outstanding links and revoke any that are no longer needed.
          </DialogDescription>
        </DialogHeader>
        <PendingInvitationsList teamKey={teamKey} submission={submission} />
      </DialogContent>
    </Dialog>
  );
}

function PendingInvitationsList({
  teamKey,
  submission,
}: {
  teamKey: string;
  submission: ReturnType<typeof useSessionFormSubmission>;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PendingTeamInvitation | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const selectedTrigger = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.teams.invitationPage(teamKey, page),
    queryFn: ({ signal }) => getPendingTeamInvitations(teamKey, page, signal),
    staleTime: 0,
    gcTime: 0,
  });
  const rows = query.data?.content ?? [];

  useEffect(() => {
    if (selected) cancelButton.current?.focus();
  }, [selected]);

  function cancel() {
    setSelected(null);
    setError("");
    selectedTrigger.current?.focus();
  }

  async function revoke(invite: PendingTeamInvitation) {
    await submission.run(async (isCurrent) => {
      setError("");
      try {
        await revokeTeamInvitation(teamKey, invite.id);
        if (!isCurrent()) return;
        await queryClient.invalidateQueries({
          queryKey: queryKeys.teams.invitations(teamKey),
        });
        if (!isCurrent()) return;
        if (page > 0 && rows.length === 1) setPage(page - 1);
        setSelected(null);
        setStatus("Invitation is no longer pending.");
        feedback.current?.focus();
      } catch (failure) {
        if (isCurrent())
          setError(
            requestError(
              failure,
              "Unable to revoke the invitation. Please try again.",
            ),
          );
      }
    });
  }

  return (
    <>
      <div
        aria-busy={submission.pending || query.isFetching}
        className="space-y-3"
      >
        {query.isPending ? (
          <p role="status">Loading invitations…</p>
        ) : query.isError ? (
          <div className="space-y-2">
            <p role="alert" className="text-destructive">
              {requestError(query.error, "Unable to load invitations.")}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={query.isFetching || submission.pending}
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">
            No pending invites{page > 0 ? " on this page" : ""}.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0 break-all">
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-muted-foreground">
                    Expires{" "}
                    <time dateTime={invite.expiresAt}>
                      {new Date(invite.expiresAt).toLocaleString()}
                    </time>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Revoke invite for ${invite.email}`}
                  aria-expanded={selected?.id === invite.id}
                  disabled={submission.pending}
                  onClick={(event) => {
                    selectedTrigger.current = event.currentTarget;
                    setSelected(invite);
                    setStatus("");
                    setError("");
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p
          ref={feedback}
          tabIndex={-1}
          role="status"
          className={status ? "text-muted-foreground" : "sr-only"}
        >
          {status}
        </p>
      </div>
      <DialogFooter className="flex-col sm:flex-col">
        {selected ? (
          <div className="space-y-3">
            <p className="wrap-anywhere">
              Revoke the invite for <strong>{selected.email}</strong>? The
              shared link will stop working.
            </p>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                ref={cancelButton}
                variant="outline"
                disabled={submission.pending}
                onClick={cancel}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={submission.pending}
                onClick={() => void revoke(selected)}
              >
                {submission.pending ? "Revoking…" : "Revoke invite"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {page > 0 || (query.data?.totalPages ?? 0) > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>Page {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.isError || !query.data || query.data.last}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Refresh
            </Button>
          </div>
        )}
      </DialogFooter>
    </>
  );
}

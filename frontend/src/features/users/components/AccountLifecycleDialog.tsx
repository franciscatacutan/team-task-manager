import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invalidateUserChange } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { authStorage } from "@/features/auth/utils/authStorage";
import { changeAccountArchive, getAccountAccessReview } from "../api/userApi";
import { USER_ROLE_LABEL } from "../constants/user.constants";
import type { User } from "../types/userType";
import { userMutationError } from "../utils/userMutationError";

export default function AccountLifecycleDialog({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [confirmedReview, setConfirmedReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const client = useQueryClient();
  const restoring = Boolean(user.archivedAt);
  const review = useQuery({
    queryKey: queryKeys.users.accessReview(user.id, page),
    queryFn: ({ signal }) => getAccountAccessReview(user.id, page, signal),
    refetchOnMount: "always",
  });
  const save = useMutation({ mutationFn: changeAccountArchiveRequest });
  const ownedTeams =
    review.data?.teams.filter(
      ({ role, archived }) => role === "OWNER" && !archived,
    ) ?? [];
  const reviewKey = review.data
    ? JSON.stringify([
        review.data.archivedAt,
        review.data.role,
        review.data.teams,
      ])
    : null;
  const confirmed = reviewKey !== null && reviewKey === confirmedReview;
  const stale = Boolean(
    review.data && Boolean(review.data.archivedAt) !== restoring,
  );

  async function changeAccountArchiveRequest() {
    const access = review.data;
    if (restoring && access?.archivedAt) {
      return changeAccountArchive(user.id, {
        archivedAt: access.archivedAt,
        role: access.role,
        teams: access.teams,
      });
    }
    if (restoring) throw new Error("The account is no longer archived.");
    return changeAccountArchive(user.id);
  }

  async function submit() {
    if (
      submitting.current ||
      !review.data ||
      stale ||
      review.isFetching ||
      review.isError ||
      (!restoring && ownedTeams.length > 0) ||
      (restoring && !confirmed)
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const revision = authStorage.getRevision();
    try {
      await save.mutateAsync();
      if (
        authStorage.getRevision() === revision &&
        !authStorage.isLoggingOut()
      ) {
        await Promise.all([
          invalidateUserChange(client, user.id),
          client.invalidateQueries({
            queryKey: queryKeys.users.accessReviews(user.id),
            refetchType: "none",
          }),
        ]);
        onClose();
      }
    } catch (failure) {
      setConfirmedReview(null);
      setError(userMutationError(failure));
      void review.refetch();
      void client.invalidateQueries({ queryKey: queryKeys.users.lists });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const title = restoring ? "Restore user" : "Archive user";
  const openTasks = review.data?.openTasks;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
        onEscapeKeyDown={(event) => {
          if (submitting.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (submitting.current) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {user.firstName} {user.lastName} ({user.email}).{" "}
            {restoring
              ? "Review the access this account will regain before restoring sign-in."
              : "Sign-in will be blocked and all sessions will end. Work history and team memberships will be kept."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {review.isPending && <p role="status">Loading account access…</p>}
          {review.isError && (
            <div className="space-y-2">
              <p role="alert">Could not load account access.</p>
              <Button
                variant="outline"
                onClick={() => void review.refetch()}
                disabled={review.isFetching}
              >
                Retry
              </Button>
            </div>
          )}
          {stale && (
            <p role="alert">
              The account status changed. Close this dialog and reopen it from
              the refreshed directory.
            </p>
          )}
          {review.data && (
            <>
              <div className="space-y-1 text-sm">
                <h3 className="font-medium">Global role</h3>
                <p>{USER_ROLE_LABEL[review.data.role]}</p>
                {restoring && review.data.role !== "USER" && (
                  <p className="text-muted-foreground">
                    This role can view all teams.
                  </p>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <h3 className="font-medium">Team memberships</h3>
                {review.data.teams.length ? (
                  <ul className="space-y-1">
                    {review.data.teams.map((team) => (
                      <li key={team.key}>
                        <Link
                          className="underline"
                          to={`/teams/${team.key}/members`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {team.name}
                        </Link>
                        {" · "}
                        {team.role === "OWNER"
                          ? "Owner"
                          : team.role === "ADMIN"
                            ? "Team admin"
                            : "Member"}
                        {team.archived && " · Archived team"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No team memberships.</p>
                )}
                {!restoring && ownedTeams.length > 0 && (
                  <p role="alert" className="text-destructive">
                    Transfer ownership of every active team listed as Owner
                    before archiving this account.
                  </p>
                )}
              </div>
              {openTasks && (
                <div className="space-y-2 text-sm">
                  <h3 className="font-medium">
                    Open work ({openTasks.totalElements})
                  </h3>
                  {openTasks.totalElements > 0 ? (
                    <>
                      <p className="text-muted-foreground">
                        Review these assignments for reassignment.
                      </p>
                      <ul className="space-y-1">
                        {openTasks.content.map((task) => {
                          const path = `/teams/${task.teamKey}/projects/${task.projectKey}/tasks/${task.number}`;
                          return (
                            <li key={path}>
                              <Link
                                className="underline"
                                to={path}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                #{task.number} {task.name}
                              </Link>
                              {" · "}
                              {task.assignee ? "Assignee" : "Support"}
                            </li>
                          );
                        })}
                      </ul>
                      {(openTasks.totalPages > 1 || page > 0) && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPage(page - 1)}
                            disabled={busy || openTasks.page === 0}
                          >
                            Previous
                          </Button>
                          <span>
                            {page + 1} / {openTasks.totalPages}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPage(page + 1)}
                            disabled={busy || openTasks.last}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No open assignments.
                    </p>
                  )}
                </div>
              )}
              {restoring && !stale && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={confirmed}
                    disabled={busy || review.isFetching || review.isError}
                    onChange={(event) =>
                      setConfirmedReview(
                        event.target.checked ? reviewKey : null,
                      )
                    }
                  />
                  <span>
                    I reviewed the global role and team memberships. Restore
                    this access.
                  </span>
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={restoring ? "default" : "destructive"}
            disabled={
              busy ||
              review.isFetching ||
              review.isError ||
              !review.data ||
              stale ||
              (restoring ? !confirmed : ownedTeams.length > 0)
            }
            onClick={() => void submit()}
          >
            {busy ? (restoring ? "Restoring…" : "Archiving…") : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

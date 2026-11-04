import { useEffect, useRef, useState, type FormEvent } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MultiUserSelector from "@/common/components/MultiUserSelector";
import { useDebounce } from "@/common/hooks/useDebounce";
import { authStorage } from "@/features/auth/utils/authStorage";
import { useRemoveMembers } from "../hooks/useRemoveMembers";
import { useAllTeamMembers } from "../hooks/useAllTeamMembers";
import { useMemberBatchSubmission } from "../hooks/useMemberBatchSubmission";
import type {
  RemoveMembersResult,
  TeamMember,
  TeamRole,
} from "../types/team.type";
import MemberBatchFeedback from "./MemberBatchFeedback";
import MemberBatchDialog from "./MemberBatchDialog";
import { memberBatchError } from "../utils/memberBatchError";

interface Props {
  userTeamRole: TeamRole;
  teamKey: string;
  open: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RemoveMultiMembersModal(props: Props) {
  if (!props.open) return null;
  return (
    <RemoveMembersEditor
      key={JSON.stringify([props.teamKey, authStorage.getRevision()])}
      {...props}
    />
  );
}

function RemoveMembersEditor(props: Props) {
  return (
    <MemberBatchDialog
      name="Remove members"
      description="Select users to remove from the team"
      onOpenChange={props.onOpenChange}
    >
      {(onPendingChange) => (
        <RemoveMembersForm {...props} onPendingChange={onPendingChange} />
      )}
    </MemberBatchDialog>
  );
}

function RemoveMembersForm({
  isLoading,
  userTeamRole,
  teamKey,
  onOpenChange,
  onPendingChange,
}: Props & { onPendingChange: (pending: boolean) => void }) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<RemoveMembersResult | null>(null);
  const [requestError, setRequestError] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result || requestError)
      feedbackRef.current?.scrollIntoView({ block: "start" });
  }, [result, requestError]);
  const [knownUsers, setKnownUsers] = useState<Record<string, TeamMember>>({});
  const debouncedSearch = useDebounce(search, 400);
  const candidates = useAllTeamMembers(teamKey, { search: debouncedSearch });
  const removeMembers = useRemoveMembers(teamKey);
  const submission = useMemberBatchSubmission(onPendingChange);
  const isSaving = submission.pending || removeMembers.isPending;
  const removableMembers = (candidates.data?.content ?? []).filter((member) =>
    userTeamRole === "OWNER"
      ? member.teamRole !== "OWNER"
      : userTeamRole === "ADMIN" && member.teamRole === "MEMBER",
  );
  const selectedUsers = selectedUserIds
    .map(
      (id) => removableMembers.find((user) => user.id === id) ?? knownUsers[id],
    )
    .filter((user): user is TeamMember => !!user);
  const labels = Object.fromEntries(
    [...Object.values(knownUsers), ...removableMembers].map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`,
    ]),
  );

  function select(ids: string[]) {
    if (submission.inFlight.current) return;
    setKnownUsers((current) =>
      Object.fromEntries(
        ids
          .map((id) => [
            id,
            removableMembers.find((user) => user.id === id) ?? current[id],
          ])
          .filter((entry): entry is [string, TeamMember] => !!entry[1]),
      ),
    );
    setSelectedUserIds(ids);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserIds.length || isLoading) return;
    await submission.run(async (isCurrent) => {
      if (!isCurrent()) return;
      const submittedIds = [...selectedUserIds];
      setResult(null);
      setRequestError("");
      try {
        const response = await removeMembers.mutateAsync({
          userIds: submittedIds,
        });
        if (!isCurrent()) return;
        if (
          !response.failed.length &&
          response.success.length === submittedIds.length
        ) {
          onOpenChange(false);
          return;
        }
        const succeeded = new Set(response.success);
        setSelectedUserIds(submittedIds.filter((id) => !succeeded.has(id)));
        setResult(response);
        if (
          response.success.length + response.failed.length !==
          submittedIds.length
        )
          setRequestError(
            "Some changes could not be confirmed. Refresh the member list before retrying.",
          );
      } catch (failure) {
        if (isCurrent()) setRequestError(memberBatchError(failure));
      }
    });
  }

  return (
    <form
      aria-label="Remove team members"
      aria-busy={isSaving || isLoading}
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex min-h-0 flex-col"
    >
      <div className="min-h-0 overflow-y-auto px-6 py-5">
        <fieldset
          disabled={isSaving || isLoading}
          className="min-w-0 space-y-6"
        >
          {isLoading && <p role="status">Loading...</p>}
          {candidates.isError && (
            <div role="alert" className="text-sm text-destructive">
              Unable to load members.{" "}
              <Button
                type="button"
                variant="outline"
                disabled={isSaving || candidates.isFetching}
                onClick={() => void candidates.refetch()}
              >
                Retry loading
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <p
              id="remove-members-users-label"
              className="text-xs font-medium text-foreground/75"
            >
              Members
            </p>
            <MultiUserSelector
              aria-labelledby="remove-members-users-label"
              search={search}
              onSearchChange={setSearch}
              users={removableMembers}
              selectedUsers={selectedUsers}
              value={selectedUserIds}
              placeholder="Search and select users..."
              onChange={select}
              disabled={isSaving || isLoading}
            />
          </div>
        </fieldset>
        <div ref={feedbackRef} className="mt-6 empty:hidden">
          <MemberBatchFeedback
            result={result}
            labels={labels}
            error={requestError}
            verb="Removed"
          />
        </div>
      </div>
      <DialogFooter className="mx-0 mb-0 shrink-0 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          disabled={isSaving}
          onClick={() => {
            if (!submission.inFlight.current) onOpenChange(false);
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          className="text-foreground"
          disabled={!selectedUserIds.length || isSaving || isLoading}
        >
          {isSaving
            ? "Removing..."
            : `Remove ${selectedUserIds.length} member${selectedUserIds.length === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </form>
  );
}

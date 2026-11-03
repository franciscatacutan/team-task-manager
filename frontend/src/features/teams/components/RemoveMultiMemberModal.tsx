import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import MultiUserSelector from "../../../common/components/MultiUserSelector";
import { useState } from "react";
import { useRemoveMembers } from "../hooks/useRemoveMembers";
import { useDebounce } from "@/common/hooks/useDebounce";
import { useAllTeamMembers } from "../hooks/useAllTeamMembers";
import type {
  RemoveMembersResult,
  TeamMember,
  TeamRole,
} from "../types/team.type";
import MemberBatchFeedback from "./MemberBatchFeedback";
import { memberBatchError } from "../utils/memberBatchError";

interface Props {
  userTeamRole: TeamRole;
  teamKey: string;
  open: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RemoveMultiMembersModal(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm p-0 rounded-xl">
        <div className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">
            Remove members
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select users to remove from the team
          </p>
        </div>
        {props.open &&
          (props.isLoading ? (
            <p className="p-6">Loading...</p>
          ) : (
            <RemoveMembersForm {...props} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function RemoveMembersForm({ userTeamRole, teamKey, onOpenChange }: Props) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<RemoveMembersResult | null>(null);
  const [requestError, setRequestError] = useState("");
  const [knownUsers, setKnownUsers] = useState<Record<string, TeamMember>>({});
  const debouncedSearch = useDebounce(search, 400);
  const candidates = useAllTeamMembers(teamKey, { search: debouncedSearch });
  const removeMembers = useRemoveMembers(teamKey);
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

  function submit() {
    if (!selectedUserIds.length) return;
    setResult(null);
    setRequestError("");
    removeMembers.mutate(
      { userIds: selectedUserIds },
      {
        onSuccess: (response) => {
          if (
            !response.failed.length &&
            response.success.length === selectedUserIds.length
          ) {
            onOpenChange(false);
            return;
          }
          const succeeded = new Set(response.success);
          setSelectedUserIds(
            selectedUserIds.filter((id) => !succeeded.has(id)),
          );
          setResult(response);
          if (
            response.success.length + response.failed.length !==
            selectedUserIds.length
          )
            setRequestError(
              "Some changes could not be confirmed. Refresh the member list before retrying.",
            );
        },
        onError: (error) => setRequestError(memberBatchError(error)),
      },
    );
  }

  return (
    <div className="px-6 py-5 space-y-6">
      {candidates.isError && (
        <div role="alert" className="text-sm text-destructive">
          Unable to load members.{" "}
          <Button variant="outline" onClick={() => void candidates.refetch()}>
            Retry loading
          </Button>
        </div>
      )}
      <MultiUserSelector
        search={search}
        onSearchChange={setSearch}
        users={removableMembers}
        selectedUsers={selectedUsers}
        value={selectedUserIds}
        placeholder="Search and select users..."
        onChange={select}
        disabled={removeMembers.isPending}
      />
      <MemberBatchFeedback
        result={result}
        labels={labels}
        error={requestError}
        verb="Removed"
      />
      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="ghost"
          disabled={removeMembers.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={submit}
          disabled={!selectedUserIds.length || removeMembers.isPending}
        >
          {removeMembers.isPending
            ? "Removing..."
            : `Remove ${selectedUserIds.length} member${selectedUserIds.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

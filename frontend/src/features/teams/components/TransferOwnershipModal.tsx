import { useState } from "react";
import { isAxiosError } from "axios";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import UserSelector from "../../../common/components/UserSelector";
import { useDebounce } from "../../../common/hooks/useDebounce";
import { useTransferOwnership } from "../hooks/useTransferOwnership";
import { useTeamMembers } from "../hooks/useTeamMembers";
import type { TeamMember } from "../types/team.type";

interface Props {
  teamKey: string;
  open: boolean;
  onClose: () => void;
  members: TeamMember[];
  preselectedUserId?: string | null;
  isCurrentOwner: boolean;
}

export default function TransferOwnershipModal({ open, ...props }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) props.onClose();
      }}
    >
      {open && <TransferOwnershipForm {...props} />}
    </Dialog>
  );
}

function TransferOwnershipForm({
  teamKey,
  onClose,
  members,
  preselectedUserId,
  isCurrentOwner,
}: Omit<Props, "open">) {
  const [selected, setSelected] = useState<TeamMember | null>(
    members.find(
      (member) =>
        member.id === preselectedUserId && member.teamRole !== "OWNER",
    ) ?? null,
  );
  const [confirmText, setConfirmText] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const candidates = useTeamMembers(teamKey, {
    page: 0,
    size: 20,
    search: debouncedSearch,
    sort: "user.lastName,asc",
  });
  const transfer = useTransferOwnership(teamKey);
  const eligibleMembers = Array.from(
    new Map(
      [...(selected ? [selected] : []), ...(candidates.data?.content ?? [])]
        .filter((member) => member.teamRole !== "OWNER")
        .map((member) => [member.id, member]),
    ).values(),
  );
  const canSubmit =
    !!selected && confirmText === "TRANSFER" && !transfer.isPending;
  const errorMessage = isAxiosError<{ message?: string }>(transfer.error)
    ? (transfer.error.response?.data?.message ??
      "Unable to transfer ownership. Please try again.")
    : "Unable to transfer ownership. Please try again.";

  function handleSubmit() {
    if (!canSubmit || !selected) return;
    transfer.mutate(selected.id, { onSuccess: onClose });
  }

  return (
    <DialogContent
      className="sm:max-w-105 p-0 rounded-xl"
      aria-describedby={undefined}
    >
      <div className="px-6 pt-6 pb-3 border-b">
        <DialogTitle className="text-base font-semibold">
          {isCurrentOwner ? "Transfer ownership" : "Recover team ownership"}
        </DialogTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a current team member as the new owner.
        </p>
      </div>
      <div className="px-6 py-5 space-y-6">
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {isCurrentOwner
            ? "You will become a team admin after this transfer."
            : "The current owner will become a team admin. This recovery will be recorded in team activity."}
        </div>
        <div className="space-y-2">
          <Label>New owner</Label>
          <UserSelector
            users={eligibleMembers}
            value={selected?.id}
            placeholder="Select new owner"
            search={search}
            onSearchChange={setSearch}
            onChange={(id) =>
              setSelected(
                eligibleMembers.find((member) => member.id === id) ?? null,
              )
            }
          />
          {candidates.isError && (
            <div role="alert" className="text-sm text-destructive">
              Unable to load team members.
              <Button variant="link" onClick={() => void candidates.refetch()}>
                Retry
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownership-confirmation">
            Type TRANSFER to confirm
          </Label>
          <Input
            id="ownership-confirmation"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
          />
        </div>
        {transfer.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {transfer.isPending ? "Transferring..." : "Transfer ownership"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

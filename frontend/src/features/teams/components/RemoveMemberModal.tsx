import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import type { TeamMember, RemoveMembersResult } from "../types/team.type";
import { useRemoveMembers } from "../hooks/useRemoveMembers";
import { useState } from "react";
import MemberBatchFeedback from "./MemberBatchFeedback";
import { memberBatchError } from "../utils/memberBatchError";

interface Props {
  teamKey: string;
  open: boolean;
  onClose: () => void;
  member: TeamMember | null;
}

export default function RemoveMemberModal({
  teamKey,
  open,
  onClose,
  member,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Member</DialogTitle>
        </DialogHeader>
        {open && member && (
          <RemoveMemberForm
            key={member.id}
            teamKey={teamKey}
            member={member}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RemoveMemberForm({
  teamKey,
  member,
  onClose,
}: {
  teamKey: string;
  member: TeamMember;
  onClose: () => void;
}) {
  const removeMember = useRemoveMembers(teamKey);
  const [result, setResult] = useState<RemoveMembersResult | null>(null);
  const [requestError, setRequestError] = useState("");
  function submit() {
    setResult(null);
    setRequestError("");
    removeMember.mutate(
      { userIds: [member.id] },
      {
        onSuccess: (response) => {
          if (response.success.includes(member.id) && !response.failed.length) {
            onClose();
            return;
          }
          setResult(response);
          if (!response.failed.length)
            setRequestError(
              "Unable to confirm removal. Refresh the member list before retrying.",
            );
        },
        onError: (error) => setRequestError(memberBatchError(error)),
      },
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Are you sure you want to remove{" "}
        <span className="font-medium">
          {member.firstName} {member.lastName}
        </span>
        ? This removes their team access.
      </p>
      <MemberBatchFeedback
        result={result}
        labels={{ [member.id]: `${member.firstName} ${member.lastName}` }}
        error={requestError}
        verb="Removed"
      />
      <div className="flex justify-end gap-2 mt-4">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={removeMember.isPending}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={submit}
          disabled={removeMember.isPending}
        >
          {removeMember.isPending ? "Removing..." : "Remove"}
        </Button>
      </div>
    </>
  );
}

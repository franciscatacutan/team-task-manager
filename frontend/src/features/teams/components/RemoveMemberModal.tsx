import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

import { Button } from "../../../components/ui/button";
import type { TeamMember } from "../types/team.type";
import { useRemoveMembers } from "../hooks/useRemoveMembers";

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
  const removeMember = useRemoveMembers(teamKey);

  const handleRemove = () => {
    if (!member?.id) return;
    removeMember.mutate(
      {
        userIds: [member.id],
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Member</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove{" "}
          <span className="font-medium">
            {member?.firstName} {member?.lastName}
          </span>
          ? This action cannot be undone.
        </p>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={removeMember.isPending}
          >
            {removeMember.isPending ? "Removing..." : "Remove"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

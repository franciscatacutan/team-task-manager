import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import UserSelector from "../../../common/components/UserSelector";
import { useTransferOwnership } from "../hooks/useTransferOwnership";
import type { TeamMember } from "../types/team.type";

interface Props {
  teamKey: string;
  open: boolean;
  onClose: () => void;
  members: TeamMember[];
  preselectedUserId?: string | null;
}

export default function TransferOwnershipModal({
  teamKey,
  open,
  onClose,
  members,
  preselectedUserId,
}: Props) {
  const [selectedUser, setSelectedUser] = useState<string | null>(
    preselectedUserId ?? null,
  );
  const [confirmText, setConfirmText] = useState("");

  const transfer = useTransferOwnership(teamKey);

  const eligibleMembers = members.filter(
    (m) =>
      m.teamRole !== "OWNER" &&
      (m.globalRole === "SUPER_ADMIN" || m.globalRole === "ADMIN"),
  );

  const canSubmit =
    !!selectedUser && confirmText === "TRANSFER" && !transfer.isPending;

  function handleSubmit() {
    if (!selectedUser) return;

    transfer.mutate(selectedUser, {
      onSuccess: () => {
        onClose();
      },
    });
  }

  if (open && selectedUser === null && preselectedUserId) {
    setSelectedUser(preselectedUserId);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {open && (
        <DialogContent
          className="sm:max-w-105 p-0 rounded-xl"
          aria-describedby={undefined}
        >
          <div className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="text-base font-semibold">
              Transfer ownership
            </DialogTitle>

            <p className="text-sm text-muted-foreground mt-1">
              Transfer full control of this team to another member.
            </p>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              You will lose owner privileges after this action.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                New owner
              </label>

              <UserSelector
                users={eligibleMembers}
                value={selectedUser ?? undefined}
                placeholder="Select new owner"
                onChange={setSelectedUser}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Type <span className="font-semibold">TRANSFER</span> to confirm
              </label>

              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-col items-center justify-between pt-2 border-t gap-2">
              <span className="text-xs text-muted-foreground">
                This action cannot be easily undone
              </span>

              <div className="flex gap-2 w-full justify-end">
                <Button variant="ghost" onClick={onClose} className="h-9">
                  Cancel
                </Button>

                <Button
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className="h-9 px-4"
                >
                  {transfer.isPending
                    ? "Transferring..."
                    : "Transfer ownership"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

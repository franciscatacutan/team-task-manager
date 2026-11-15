import CreationDialog from "@/common/components/CreationDialog";
import { CreateTeamForm } from "./CreateTeamForm";
import type { Team } from "../types/team.type";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (team: Team) => void;
}

export function CreateTeamModal({ open, onOpenChange, onSuccess }: Props) {
  return (
    <CreationDialog
      open={open}
      onOpenChange={onOpenChange}
      name="Create Team"
      description="Create a workspace for your team. Required fields are marked with *."
    >
      {(onPendingChange) => (
        <CreateTeamForm
          onPendingChange={onPendingChange}
          onSuccess={(team) => {
            onOpenChange(false);
            onSuccess?.(team);
          }}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </CreationDialog>
  );
}

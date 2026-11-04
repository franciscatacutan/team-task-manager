import CreationDialog from "@/common/components/CreationDialog";
import { CreateProjectForm } from "./CreateProjectForm";

interface Props {
  teamKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ teamKey, open, onOpenChange }: Props) {
  return (
    <CreationDialog
      key={teamKey}
      open={open}
      onOpenChange={onOpenChange}
      name="Create Project"
      description="Create a project in this team. Required fields are marked with *."
    >
      {(onPendingChange) => (
        <CreateProjectForm
          teamKey={teamKey}
          onPendingChange={onPendingChange}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </CreationDialog>
  );
}

import CreationDialog from "@/common/components/CreationDialog";
import { CreateTaskForm } from "./CreateTaskForm";

interface Props {
  teamKey: string;
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskModal({
  teamKey,
  projectKey,
  open,
  onOpenChange,
}: Props) {
  return (
    <CreationDialog
      key={JSON.stringify([teamKey, projectKey])}
      open={open}
      onOpenChange={onOpenChange}
      name="Create Task"
      description="Add a task to this project. Required fields are marked with *."
    >
      {(onPendingChange) => (
        <CreateTaskForm
          teamKey={teamKey}
          projectKey={projectKey}
          onPendingChange={onPendingChange}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </CreationDialog>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { CreateTaskForm } from "./CreateTaskForm";

interface Props {
  teamKey: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskModal({
  teamKey,
  projectId,
  open,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <CreateTaskForm
          teamKey={teamKey}
          projectId={projectId}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

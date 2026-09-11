import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <CreateTaskForm
          teamKey={teamKey}
          projectKey={projectKey}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  Dialog,
} from "../../../components/ui/dialog";
import { CreateProjectForm } from "./CreateProjectForm";

interface Props {
  teamKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ teamKey, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <CreateProjectForm
          teamKey={teamKey}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

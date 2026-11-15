import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { TaskScope } from "@/features/tasks/types/task.types";
import TaskView from "./TaskView";
import { isValidTaskScope } from "@/features/tasks/utils/taskView";

interface Props extends TaskScope {
  open: boolean;
  onClose: () => void;
  onTaskDeleted: () => void;
  isWorkspaceReadOnly: boolean;
}
/** Dialog adapter: no workspace layout context, task queries, or duplicated permission policy. */
export default function TaskModal({ open, onClose, ...props }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className="flex h-[min(92vh,860px)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-background p-0 shadow-2xl sm:max-w-5xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {isValidTaskScope(props)
            ? `Task #${props.taskNumber}`
            : "Task details"}
        </DialogTitle>
        {open && <TaskView {...props} presentation="dialog" />}
      </DialogContent>
    </Dialog>
  );
}

import EditableField from "../../../common/components/EditableField";
import { useUpdateTask } from "../hooks/useUpdateTask";
import type { Task } from "../types/task.types";
import type { TaskPermissions } from "../utils/taskPermissions";

interface Props {
  teamKey: string;
  projectKey: string;
  task: Task;
  permissions: TaskPermissions;
}

export default function TaskDescription({
  teamKey,
  projectKey,
  task,
  permissions,
}: Props) {
  const updateTask = useUpdateTask(teamKey, projectKey, task.taskNumber);

  return (
    <section className="space-y-2 rounded-2xl border border-border/60 bg-background p-5 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Description</h2>
      </div>

      <EditableField
        value={task.description}
        displayClassName="text-sm leading-7 text-foreground/90"
        placeholder="No Description Yet"
        multiline
        maxLength={2000}
        inputClassName="text-sm leading-7 text-foreground"
        onSave={(value) => updateTask.mutate({ description: value })}
        disabled={!permissions.canEditTaskDetails}
      />
    </section>
  );
}

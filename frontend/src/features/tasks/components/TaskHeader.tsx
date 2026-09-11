import EditableField from "../../../common/components/EditableField";
import PriorityBadge from "../../../common/components/PriorityBadge";
import { useUpdateTask } from "../hooks/useUpdateTask";
import type { Task } from "../types/task.types";
import type { TaskPermissions } from "../utils/taskPermissions";
import { TaskStatusLabel, TaskStatusStyles } from "../utils/task.constants";
import DeleteTaskButton from "./DeleteTaskButton";

interface Props {
  teamKey: string;
  projectKey: string;
  task: Task;
  permissions: TaskPermissions;
  onTaskDeleted?: () => void;
}

export default function TaskHeader({
  teamKey,
  projectKey,
  task,
  permissions,
  onTaskDeleted,
}: Props) {
  const updateTask = useUpdateTask(teamKey, projectKey, task.id);

  return (
    <div className="border-b border-border/60 bg-background/96 px-6 py-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-7">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="inline-flex items-center rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Task #{task.taskNumber}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={TaskStatusStyles[task.status]}>
                {TaskStatusLabel[task.status]}
              </span>
              <PriorityBadge
                priority={task.priority ?? "LOW"}
                className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.12em]"
              />
            </div>
          </div>

          {permissions.canDeleteTask && (
            <DeleteTaskButton
              teamKey={teamKey}
              projectKey={projectKey}
              taskId={task.id}
              taskTitle={task.title}
              onTaskDeleted={onTaskDeleted}
            />
          )}
        </div>

        <EditableField
          value={task.title}
          maxLength={100}
          displayClassName="text-xl font-semibold leading-tight text-foreground sm:text-2xl"
          inputClassName="text-xl font-semibold sm:text-2xl"
          onSave={(value) => updateTask.mutate({ title: value })}
          disabled={!permissions.canEditTaskDetails}
        />
      </div>
    </div>
  );
}

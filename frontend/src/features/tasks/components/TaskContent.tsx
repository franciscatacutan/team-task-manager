import { cn } from "@/lib/utils";
import type { Task, TaskScope } from "@/features/tasks/types/task.types";
import type { TaskPermissions } from "@/features/tasks/utils/taskPermissions";
import TaskHeader from "./TaskHeader";
import TaskDescription from "./TaskDescription";
import TaskCommentForm from "./TaskCommentForm";
import TaskActivity from "./TaskActivity";
import TaskMetadata from "./TaskMetadata";

interface Props extends TaskScope {
  task: Task;
  permissions: TaskPermissions;
  presentation: "page" | "dialog";
  onTaskDeleted?: () => void;
}
/** Shared loaded content. Routing, authentication and queries belong to adapters/controller. */
export default function TaskContent({
  task,
  teamKey,
  projectKey,
  permissions,
  presentation,
  onTaskDeleted,
}: Props) {
  const page = presentation === "page";
  return (
    <>
      <TaskHeader
        task={task}
        teamKey={teamKey}
        projectKey={projectKey}
        permissions={permissions}
        onTaskDeleted={onTaskDeleted}
      />
      <div
        className={cn(
          "flex-1 min-h-0 bg-muted/10",
          page && "px-4 py-4 sm:px-6 sm:py-5",
        )}
      >
        <div
          className={cn(
            "flex h-full min-h-0 flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-4",
            page
              ? "mx-auto max-w-6xl"
              : "overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 xl:overflow-hidden",
          )}
        >
          <div className="order-2 flex min-h-0 flex-col gap-4 xl:order-1">
            <TaskDescription
              teamKey={teamKey}
              projectKey={projectKey}
              task={task}
              permissions={permissions}
            />
            {permissions.canComment && (
              <TaskCommentForm
                teamKey={teamKey}
                projectKey={projectKey}
                taskNumber={task.taskNumber}
              />
            )}
            <TaskActivity
              teamKey={teamKey}
              projectKey={projectKey}
              taskNumber={task.taskNumber}
              className="min-h-[22rem] xl:min-h-0 xl:flex-1"
            />
          </div>
          <aside className="order-1 xl:order-2 xl:min-h-0 xl:overflow-y-auto">
            <TaskMetadata
              task={task}
              teamKey={teamKey}
              projectKey={projectKey}
              permissions={permissions}
            />
          </aside>
        </div>
      </div>
    </>
  );
}

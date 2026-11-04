import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTeamMe } from "@/features/teams/hooks/useTeamMe";
import QueryFailure from "@/common/components/QueryFailure";
import { useTask } from "@/features/tasks/hooks/useTask";
import type { TaskScope } from "@/features/tasks/types/task.types";
import { getTaskPermissions } from "@/features/tasks/utils/taskPermissions";
import {
  isTaskUnavailable,
  isValidTaskScope,
} from "@/features/tasks/utils/taskView";
import TaskContent from "./TaskContent";
import TaskViewState from "./TaskViewState";

interface Props extends TaskScope {
  presentation: "page" | "dialog";
  isWorkspaceReadOnly: boolean;
  onTaskDeleted?: () => void;
}
/** Validates identity before mounting data hooks; each task gets an independent editor lifecycle. */
export default function TaskView(props: Props) {
  if (!isValidTaskScope(props)) return <TaskViewState state="invalid" />;
  return (
    <TaskViewController
      key={JSON.stringify([props.teamKey, props.projectKey, props.taskNumber])}
      {...props}
    />
  );
}

function TaskViewController(props: Props) {
  const { teamKey, projectKey, taskNumber, isWorkspaceReadOnly } = props;
  const taskQuery = useTask(teamKey, projectKey, taskNumber);
  const membershipQuery = useTeamMe(teamKey);
  const { user } = useAuth();
  if (taskQuery.isPending || taskQuery.isLoading)
    return <TaskViewState state="loading" />;
  if (!taskQuery.data || isTaskUnavailable(taskQuery.error))
    return (
      <TaskViewState
        state={
          taskQuery.isError && !isTaskUnavailable(taskQuery.error)
            ? "error"
            : "unavailable"
        }
        onRetry={taskQuery.refetch}
        retrying={taskQuery.isFetching}
      />
    );
  const task = taskQuery.data;
  // Failed membership reads cannot leave cached management controls enabled.
  const membership = membershipQuery.isError ? undefined : membershipQuery.data;
  const permissions = getTaskPermissions({
    globalRole: user?.role,
    teamRole: membership?.role,
    userId: membership?.userId,
    assigneeId: task.assignedUser?.id,
    supportId: task.supportUser?.id,
    isReadOnly: Boolean(isWorkspaceReadOnly || task.deletedAt || task.readOnly),
  });
  return (
    <div className="flex h-full min-h-0 flex-col">
      {taskQuery.isError && (
        <div className="p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Showing the last loaded task while refresh is unavailable.
          </p>
          <QueryFailure
            label="the latest task"
            onRetry={taskQuery.refetch}
            pending={taskQuery.isFetching}
          />
        </div>
      )}
      {membershipQuery.isError && (
        <div className="p-4">
          <QueryFailure
            label="task permissions"
            onRetry={membershipQuery.refetch}
            pending={membershipQuery.isFetching}
          />
        </div>
      )}
      <TaskContent {...props} task={task} permissions={permissions} />
    </div>
  );
}

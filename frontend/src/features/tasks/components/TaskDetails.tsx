import { useOutletContext, useParams } from "react-router-dom";
import TaskDescription from "./TaskDescription";
import TaskHeader from "./TaskHeader";
import TaskMetadata from "./TaskMetadata";
import TaskActivity from "./TaskActivity";
import TaskCommentForm from "./TaskCommentForm";
import { useTask } from "../hooks/useTask";
import { useTeamMe } from "../../teams/hooks/useTeamMe";
import { getTaskPermissions } from "../utils/taskPermissions";
import { getUserFromToken } from "../../users/api/userApi";
import type { WorkspaceOutletContext } from "@/layout/workspace/WorkspaceLayout";

export default function TaskDetailsPage() {
  const { teamKey, projectId, taskId } = useParams<{
    teamKey: string;
    projectId: string;
    taskId: string;
  }>();

  const { data: task, isLoading } = useTask(
    teamKey || "",
    projectId || "",
    taskId || "",
  );

  const user = getUserFromToken();
  const { data: teamMe } = useTeamMe(teamKey || "");
  const { team } = useOutletContext<WorkspaceOutletContext>();
  const isWorkspaceReadOnly = Boolean(team.deletedAt);

  if (!teamKey || !projectId || !taskId) {
    return <div className="p-6">Invalid task</div>;
  }

  if (isLoading || !task) {
    return <div className="p-6">Loading task...</div>;
  }

  const permissions = getTaskPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    userId: teamMe?.userId,
    assigneeId: task?.assignedUser?.id,
    supportId: task?.supportUser?.id,
    isReadOnly: isWorkspaceReadOnly,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TaskHeader
        task={task}
        teamKey={teamKey}
        projectId={projectId}
        permissions={permissions}
      />

      <div className="flex-1 min-h-0 bg-muted/10 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-4">
          <div className="order-2 flex min-h-0 flex-col gap-4 xl:order-1">
            <TaskDescription
              teamKey={teamKey}
              projectId={projectId}
              task={task}
              permissions={permissions}
            />
            {permissions.canComment && (
              <TaskCommentForm
                teamKey={teamKey}
                projectId={projectId}
                taskId={task.id}
              />
            )}

            <TaskActivity
              teamKey={teamKey}
              projectId={projectId}
              taskId={task.id}
              className="min-h-[22rem] xl:min-h-0 xl:flex-1"
            />
          </div>

          <aside className="order-1 xl:order-2 xl:min-h-0 xl:overflow-y-auto">
            <TaskMetadata
              permissions={permissions}
              teamKey={teamKey}
              projectId={projectId}
              task={task}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

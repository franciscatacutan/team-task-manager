import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useOutletContext } from "react-router-dom";
import { useTeamMe } from "../../teams/hooks/useTeamMe";
import { useTask } from "../hooks/useTask";
import { getTaskPermissions } from "../utils/taskPermissions";
import TaskDescription from "./TaskDescription";
import TaskHeader from "./TaskHeader";
import TaskMetadata from "./TaskMetadata";
import TaskActivity from "./TaskActivity";
import TaskCommentForm from "./TaskCommentForm";
import { getUserFromToken } from "../../users/api/userApi";
import type { WorkspaceOutletContext } from "@/layout/workspace/WorkspaceLayout";

interface Props {
  open: boolean;
  onClose: () => void;
  taskId: string;
  teamKey: string;
  projectId: string;
  onTaskDeleted: () => void;
}

export default function TaskModal({
  open,
  onClose,
  taskId,
  teamKey,
  projectId,
  onTaskDeleted,
}: Props) {
  const { data: task, isLoading } = useTask(teamKey, projectId, taskId);
  const user = getUserFromToken();
  const { data: teamMe } = useTeamMe(teamKey);
  const { team } = useOutletContext<WorkspaceOutletContext>();
  const isWorkspaceReadOnly = Boolean(team.deletedAt);

  const permissions = getTaskPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    userId: teamMe?.userId,
    assigneeId: task?.assignedUser?.id,
    supportId: task?.supportUser?.id,
    isReadOnly: isWorkspaceReadOnly,
  });

  if (isLoading || !task) {
    return <div className="p-6">Loading task...</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="flex h-[min(92vh,860px)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-background p-0 shadow-2xl sm:max-w-5xl"
        aria-describedby={undefined}
      >
        <DialogTitle>
          <TaskHeader
            task={task}
            teamKey={teamKey}
            projectId={projectId}
            permissions={permissions}
            onTaskDeleted={onTaskDeleted}
          />
        </DialogTitle>

        <div className="flex-1 min-h-0 bg-muted/10">
          <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-4 xl:overflow-hidden">
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
      </DialogContent>
    </Dialog>
  );
}

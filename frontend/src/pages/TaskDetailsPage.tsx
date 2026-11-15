import { useOutletContext, useParams } from "react-router";
import { TaskView } from "@/features/tasks";
import type { WorkspaceOutletContext } from "@/layout/workspace/WorkspaceLayout";

/** Route adapter: translate URL/workspace context into the feature's explicit input. */
export default function TaskDetailsPage() {
  const { teamKey, projectKey, taskNumber } = useParams<{
    teamKey: string;
    projectKey: string;
    taskNumber: string;
  }>();
  const { team } = useOutletContext<WorkspaceOutletContext>();
  return (
    <TaskView
      teamKey={teamKey ?? ""}
      projectKey={projectKey ?? ""}
      taskNumber={Number(taskNumber)}
      isWorkspaceReadOnly={Boolean(team.deletedAt)}
      presentation="page"
    />
  );
}

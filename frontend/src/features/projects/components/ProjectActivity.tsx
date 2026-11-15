import { useActivityFeedState } from "@/common/hooks/useActivityFeedState";

import { useProjectActivity } from "../hooks/useProjectActivities";
import { ActivityFeed } from "../../../common/components/activity/ActivityFeed";

interface Props {
  teamKey: string;
  projectKey: string;
  onOpenTask: (taskNumber: number) => void;
}

export default function ProjectActivity({
  teamKey,
  projectKey,
  onOpenTask,
}: Props) {
  const feed = useActivityFeedState(JSON.stringify([teamKey, projectKey]));
  const { data, isPending, isError, isFetching, refetch } = useProjectActivity(
    teamKey,
    projectKey,
    feed.params,
  );
  feed.recoverPage(!isError ? data?.totalPages : undefined);

  return (
    <ActivityFeed
      variant="project"
      copy={{
        description:
          "A running project log of task movement, status changes, assignments, and key edits.",
      }}
      data={{
        items: data?.content ?? [],
        isLoading: isPending || feed.searching,
        isError: isError && !feed.searching,
        isFetching: isFetching || feed.searching,
        onRetry: refetch,
        page: data?.page ?? feed.params.page,
        totalPages: data?.totalPages ?? 0,
        totalElements: data?.totalElements ?? 0,
      }}
      controls={{
        ...feed.controls,
        groupByOptions: [
          { value: "date", label: "Date" },
          { value: "task", label: "Task" },
          { value: "person", label: "Person" },
          { value: "type", label: "Type" },
        ],
      }}
      behavior={{
        onOpenTask: (item) => {
          if (item.targetPath && item.task?.taskNumber) {
            onOpenTask(item.task.taskNumber);
          }
        },
      }}
    />
  );
}

import { useActivityFeedState } from "@/common/hooks/useActivityFeedState";

import { ActivityFeed } from "../../../common/components/activity/ActivityFeed";
import { useTeamActivities } from "../hooks/useTeamActivities";
import { useNavigate, useParams } from "react-router";

export default function TeamActivity() {
  const { teamKey } = useParams<{ teamKey: string }>();

  const navigate = useNavigate();

  const feed = useActivityFeedState(JSON.stringify([teamKey]));
  const { data, isPending, isError, isFetching, refetch } = useTeamActivities(
    teamKey || "",
    feed.params,
  );
  feed.recoverPage(!isError ? data?.totalPages : undefined);

  return (
    <ActivityFeed
      variant="team"
      copy={{
        description:
          "A team-wide history log showing membership changes, project movement, and task-level collaboration.",
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
          { value: "project", label: "Project" },
          { value: "person", label: "Person" },
          { value: "type", label: "Type" },
          { value: "task", label: "Task" },
        ],
      }}
      behavior={{
        onOpenTask: (item) => {
          if (item.targetPath) navigate(item.targetPath);
        },
      }}
    />
  );
}

import { useState } from "react";

import { useProjectActivity } from "../hooks/useProjectActivities";
import {
  ActivityFeed,
  type ActivityFeedGroupBy,
} from "../../../common/components/activity/ActivityFeed";

interface Props {
  teamKey: string;
  projectKey: string;
  onOpenTask: (taskId: string) => void;
}

export default function ProjectActivity({
  teamKey,
  projectKey,
  onOpenTask,
}: Props) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt,desc");
  const [groupBy, setGroupBy] = useState<ActivityFeedGroupBy>("date");

  const { data, isLoading } = useProjectActivity(teamKey, projectKey, {
    page: page,
    size: 1000,
    search,
    sort,
  });

  return (
    <ActivityFeed
      variant="project"
      copy={{
        description:
          "A running project log of task movement, status changes, assignments, and key edits.",
      }}
      data={{
        items: data?.content ?? [],
        isLoading,
        page: data?.page ?? page,
        totalPages: data?.totalPages ?? 0,
        totalElements: data?.totalElements ?? 0,
      }}
      controls={{
        search,
        sort,
        groupBy,
        groupByOptions: [
          { value: "date", label: "Date" },
          { value: "task", label: "Task" },
          { value: "person", label: "Person" },
          { value: "type", label: "Type" },
        ],
        onSearchChange: (value) => {
          setSearch(value);
          setPage(0);
        },
        onSortChange: (value) => {
          setSort(value);
          setPage(0);
        },
        onGroupByChange: setGroupBy,
        onPageChange: setPage,
      }}
      behavior={{
        onOpenTask: (item) => {
          if (item.task?.id) {
            onOpenTask(item.task.id);
          }
        },
      }}
    />
  );
}

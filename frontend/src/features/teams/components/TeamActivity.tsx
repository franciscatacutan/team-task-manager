import { useState } from "react";

import {
  ActivityFeed,
  type ActivityFeedGroupBy,
} from "../../../common/components/activity/ActivityFeed";
import { useTeamActivities } from "../hooks/useTeamActivities";
import { useNavigate, useParams } from "react-router-dom";

export default function TeamActivity() {
  const { teamKey } = useParams<{ teamKey: string }>();

  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt,desc");
  const [groupBy, setGroupBy] = useState<ActivityFeedGroupBy>("date");

  const { data, isLoading } = useTeamActivities(teamKey || "", {
    page: page,
    size: 1000,
    search,
    sort,
  });

  function openTask(projectKey: string, taskNumber: string) {
    navigate(`/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}`);
  }

  return (
    <ActivityFeed
      variant="team"
      copy={{
        description:
          "A team-wide history log showing membership changes, project movement, and task-level collaboration.",
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
          { value: "project", label: "Project" },
          { value: "person", label: "Person" },
          { value: "type", label: "Type" },
          { value: "task", label: "Task" },
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
          if ("project" in item && item.project?.id && item.task?.id) {
            openTask(item.project.key, item.task.taskNumber);
          }
        },
      }}
    />
  );
}

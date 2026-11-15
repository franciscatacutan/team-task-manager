import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import UserSelector from "@/common/components/UserSelector";
import { useDebounce } from "@/common/hooks/useDebounce";
import { queryKeys } from "@/common/query/queryKeys";
import type { DeletedFilter } from "@/common/types/deletedFilter.types";
import { getProjectAssignees } from "../api/taskApi";

interface Props {
  teamKey: string;
  projectKey: string;
  deletedFilter: DeletedFilter;
  value?: string;
  onChange: (id: string | null) => void;
}

export default function ProjectAssigneeFilter({
  teamKey,
  projectKey,
  deletedFilter,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const params = { deletedFilter, search: debouncedSearch };
  const choices = useInfiniteQuery({
    queryKey: queryKeys.tasks.assignees(teamKey, projectKey, params),
    queryFn: ({ pageParam, signal }) =>
      getProjectAssignees(
        teamKey,
        projectKey,
        { ...params, page: pageParam },
        signal,
      ),
    enabled: open,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.last ? undefined : lastPage.page + 1,
  });
  const selectedParams = { deletedFilter, assigneeId: value };
  const selected = useQuery({
    queryKey: queryKeys.tasks.assignees(teamKey, projectKey, selectedParams),
    queryFn: ({ signal }) =>
      getProjectAssignees(teamKey, projectKey, selectedParams, signal),
    enabled: Boolean(value),
  });

  return (
    <UserSelector
      aria-label="Filter by assignee"
      className="w-48 max-w-full"
      placeholder={value ? "Assignee filter applied" : "All assignees"}
      clearLabel="All assignees"
      usersLabel="assignees"
      value={value}
      users={
        choices.isError
          ? []
          : (choices.data?.pages.flatMap((page) => page.content) ?? [])
      }
      selectedUser={selected.isError ? undefined : selected.data?.content[0]}
      allowClear={Boolean(value)}
      search={search}
      onSearchChange={setSearch}
      onOpenChange={setOpen}
      isLoading={choices.isPending || search !== debouncedSearch}
      error={choices.isError ? "Unable to load project assignees." : undefined}
      onRetry={() => void choices.refetch()}
      hasMore={choices.hasNextPage}
      isLoadingMore={choices.isFetchingNextPage}
      onLoadMore={() => void choices.fetchNextPage()}
      onChange={onChange}
    />
  );
}

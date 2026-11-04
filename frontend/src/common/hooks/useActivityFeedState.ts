import { useState } from "react";
import { useDebounce } from "./useDebounce";
import type { ActivityFeedGroupBy } from "../components/activity/ActivityFeed";

const initial = (scope: string) => ({
  scope,
  page: 0,
  search: "",
  sort: "createdAt,desc",
  groupBy: "date" as ActivityFeedGroupBy,
});
export function useActivityFeedState(scope: string) {
  const [state, setState] = useState(() => initial(scope));
  const current = state.scope === scope ? state : initial(scope);
  if (state.scope !== scope) setState(current);
  const debounced = useDebounce(
    JSON.stringify([scope, current.search.trim()]),
    300,
  );
  const [debouncedScope, text] = JSON.parse(debounced) as [string, string];
  const search = debouncedScope === scope ? text : "";
  return {
    params: { page: current.page, size: 20, search, sort: current.sort },
    searching: search !== current.search.trim(),
    recoverPage(totalPages: number | undefined) {
      if (
        totalPages !== undefined &&
        current.page > Math.max(0, totalPages - 1)
      )
        setState({ ...current, page: Math.max(0, totalPages - 1) });
    },
    controls: {
      search: current.search,
      sort: current.sort,
      groupBy: current.groupBy,
      onSearchChange: (search: string) =>
        setState({ ...current, search, page: 0 }),
      onSortChange: (sort: string) => setState({ ...current, sort, page: 0 }),
      onGroupByChange: (groupBy: ActivityFeedGroupBy) =>
        setState({ ...current, groupBy }),
      onPageChange: (page: number) => setState({ ...current, page }),
    },
  };
}

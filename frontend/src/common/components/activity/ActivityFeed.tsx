import { CalendarDays, Search } from "lucide-react";
import { useMemo } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { ActivityItem, type ActivityRecord } from "./ActivityItem";
import { formatDate } from "../../utils/dateFormatter";
import { getActivityTypeLabel } from "../../utils/activityFormatter";

export type ActivityFeedGroupBy =
  | "date"
  | "project"
  | "task"
  | "person"
  | "type";
type ActivityFeedVariant = "team" | "project" | "task";

interface ActivityFeedDetails {
  title: string;
  description: string;
  scopeLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  searchPlaceholder: string;
}

interface ActivityFeedProps {
  variant: ActivityFeedVariant;
  copy?: Partial<ActivityFeedDetails>;
  data: {
    items: ActivityRecord[];
    isLoading: boolean;
    page: number;
    totalPages: number;
    totalElements: number;
  };
  controls: {
    search: string;
    sort: string;
    groupBy: ActivityFeedGroupBy;
    groupByOptions: Array<{
      value: ActivityFeedGroupBy;
      label: string;
    }>;
    onSearchChange: (value: string) => void;
    onSortChange: (value: string) => void;
    onGroupByChange: (value: ActivityFeedGroupBy) => void;
    onPageChange: (page: number) => void;
  };
  behavior?: {
    onOpenTask?: (item: ActivityRecord) => void;
    interactiveItems?: boolean;
    showHeaderMeta?: boolean;
  };
}

const ACTIVITY_FEED_DEFAULTS: Record<ActivityFeedVariant, ActivityFeedDetails> =
  {
    team: {
      title: "Team Activity",
      description: "Review recent updates across projects and tasks.",
      scopeLabel: "Team scope",
      emptyTitle: "No team activity yet",
      emptyDescription:
        "Updates across projects and tasks will appear here as your team starts collaborating.",
      searchPlaceholder: "Search team activity...",
    },
    project: {
      title: "Project Activity",
      description:
        "Track task movement, updates, and decisions inside this project.",
      scopeLabel: "Project scope",
      emptyTitle: "No project activity yet",
      emptyDescription:
        "As work starts moving on this project, updates and task changes will show up here.",
      searchPlaceholder: "Search project activity...",
    },
    task: {
      title: "Task Activity",
      description:
        "A focused stream of updates, comments, and task changes for this work item.",
      scopeLabel: "Task scope",
      emptyTitle: "No task activity yet",
      emptyDescription:
        "New comments and task changes will appear here as work progresses.",
      searchPlaceholder: "Search task activity...",
    },
  };

function groupActivity(items: ActivityRecord[], groupBy: ActivityFeedGroupBy) {
  return items.reduce<Record<string, ActivityRecord[]>>((groups, item) => {
    let key = new Date(item.createdAt).toDateString();

    if (groupBy === "project") {
      key =
        "project" in item
          ? (item.project?.name ?? "No project")
          : "Current task";
    }

    if (groupBy === "task") {
      key = item.task?.name ?? "Current task";
    }

    if (groupBy === "person") {
      key = `${item.user.firstName} ${item.user.lastName}`.trim();
    }

    if (groupBy === "type") {
      key = getActivityTypeLabel(item);
    }

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);

    return groups;
  }, {});
}

function filterActivity(items: ActivityRecord[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return items;
  }

  return items.filter((item) => {
    const fullName = `${item.user.firstName} ${item.user.lastName}`
      .trim()
      .toLowerCase();
    const taskName = (item.task?.name ?? "").toLowerCase();
    const projectName = (
      "project" in item ? (item.project?.name ?? "") : ""
    ).toLowerCase();
    const typeLabel = getActivityTypeLabel(item).toLowerCase();
    const message = item.message.toLowerCase();

    return (
      fullName.includes(normalizedSearch) ||
      taskName.includes(normalizedSearch) ||
      projectName.includes(normalizedSearch) ||
      typeLabel.includes(normalizedSearch) ||
      message.includes(normalizedSearch)
    );
  });
}

function sortGroupedEntries(
  entries: Array<[string, ActivityRecord[]]>,
  groupBy: ActivityFeedGroupBy,
  sort: string,
) {
  if (groupBy === "date") {
    return entries;
  }

  return [...entries].sort((a, b) => {
    if (sort === "createdAt,asc") {
      return a[0].localeCompare(b[0]);
    }

    return b[0].localeCompare(a[0]);
  });
}

export function ActivityFeed({
  variant,
  copy,
  data,
  controls,
  behavior,
}: ActivityFeedProps) {
  const resolvedCopy = { ...ACTIVITY_FEED_DEFAULTS[variant], ...copy };
  const interactiveItems = behavior?.interactiveItems ?? true;
  const showHeaderMeta = behavior?.showHeaderMeta ?? true;

  const filteredItems = useMemo(
    () => filterActivity(data.items, controls.search),
    [data.items, controls.search],
  );
  const grouped = useMemo(
    () => groupActivity(filteredItems, controls.groupBy),
    [filteredItems, controls.groupBy],
  );
  const groupEntries = useMemo(
    () =>
      sortGroupedEntries(
        Object.entries(grouped),
        controls.groupBy,
        controls.sort,
      ),
    [grouped, controls.groupBy, controls.sort],
  );
  const isFirstPage = data.page === 0;
  const isLastPage = data.totalPages === 0 || data.page + 1 >= data.totalPages;

  if (data.isLoading) {
    return (
      <section className="space-y-4 py-4">
        <div className="space-y-3 px-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-18 animate-pulse rounded-xl bg-muted/35"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2">
      <header className="space-y-3">
        {showHeaderMeta && (
          <div className="rounded-2xl border border-border/60 bg-linear-to-br from-background via-background to-muted/20 px-4 py-4 space-y-1.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {resolvedCopy.scopeLabel}
            </p>
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-foreground">
                {resolvedCopy.title}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {resolvedCopy.description}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={resolvedCopy.searchPlaceholder}
              value={controls.search}
              onChange={(e) => controls.onSearchChange(e.target.value)}
              className="h-10 rounded-xl border-border/70 bg-background pl-9 shadow-none"
            />
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Select
              value={controls.groupBy}
              onValueChange={(value) =>
                controls.onGroupByChange(value as ActivityFeedGroupBy)
              }
            >
              <SelectTrigger className="h-10 w-full min-w-40 rounded-xl border-border/70 bg-background shadow-none sm:w-44">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>

              <SelectContent>
                {controls.groupByOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    Group: {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={controls.sort} onValueChange={controls.onSortChange}>
              <SelectTrigger className="h-10 w-full min-w-40 rounded-xl border-border/70 bg-background shadow-none sm:w-44">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="createdAt,desc">Newest first</SelectItem>
                <SelectItem value="createdAt,asc">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="flex flex-col flex-1 space-y-4 overflow-auto p-2 rounded-xl border border-border/60 bg-background/70">
        {groupEntries.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-2xl bg-background p-4 shadow-sm">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {resolvedCopy.emptyTitle}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {resolvedCopy.emptyDescription}
            </p>
          </div>
        ) : (
          groupEntries.map(([groupLabel, groupItems]) => (
            <section
              key={groupLabel}
              className="m-0 space-y-2 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {controls.groupBy === "date"
                    ? formatDate(groupLabel)
                    : groupLabel}
                </h3>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              <div className="space-y-0">
                {groupItems.map((item) => (
                  <ActivityItem
                    key={item.id}
                    item={item}
                    interactive={interactiveItems}
                    onOpenTask={
                      behavior?.onOpenTask
                        ? () => behavior.onOpenTask?.(item)
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {data.totalPages > 1 && (
        <footer className="flex items-center justify-between border-t border-border/50 bg-transparent px-4 pt-3">
          <p className="text-sm text-muted-foreground">
            Showing page {data.page + 1} of {data.totalPages}
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => controls.onPageChange(data.page - 1)}
              disabled={isFirstPage}
              className="rounded-xl"
            >
              Previous
            </Button>

            <Button
              type="button"
              onClick={() => controls.onPageChange(data.page + 1)}
              disabled={isLastPage}
              className="rounded-xl"
            >
              Next
            </Button>
          </div>
        </footer>
      )}
    </section>
  );
}

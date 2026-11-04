import QueryFailure from "@/common/components/QueryFailure";
import { requestError } from "@/common/utils/requestError";
import { authStorage } from "@/features/auth/utils/authStorage";
import { browserSession } from "@/features/auth/utils/sessionCoordinator";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  CheckCheck,
  Circle,
  FolderKanban,
  ListChecks,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { useMarkAllNotificationsRead } from "../hooks/useMarkAllNotificationsRead";
import { useMarkNotificationRead } from "../hooks/useMarkNotificationRead";
import { useNotifications } from "../hooks/useNotifications";
import { useUnreadNotificationCount } from "../hooks/useUnreadNotificationCount";
import type {
  AppNotification,
  NotificationEventType,
  NotificationType,
} from "../types/notification.types";

const iconByType = {
  TEAM: UsersRound,
  PROJECT: FolderKanban,
  TASK: ListChecks,
} satisfies Record<NotificationType, typeof Bell>;

const eventLabels: Partial<Record<NotificationEventType, string>> = {
  TASK_CREATED: "Assignment",
  TASK_ASSIGNEE_CHANGED: "Assignment",
  TASK_SUPPORT_ASSIGNED: "Support",
  TASK_SUPPORT_CHANGED: "Support",
  TASK_SUPPORT_REMOVED: "Support",
  TASK_COMMENTED: "Comment",
  TASK_STATUS_CHANGED: "Status",
  TASK_UPDATED: "Task",
  TASK_DELETED: "Archive",
  PROJECT_CREATED: "Project",
  PROJECT_UPDATED: "Project",
  PROJECT_STATUS_CHANGED: "Status",
  PROJECT_DELETED: "Archive",
  TEAM_MEMBER_ADDED: "Member",
  TEAM_MEMBER_REMOVED: "Member",
  TEAM_MEMBER_ROLE_CHANGED: "Role",
  TEAM_OWNERSHIP_TRANSFERRED: "Ownership",
  TEAM_UPDATED: "Team",
  TEAM_DELETED: "Archive",
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<{
    filter: "all" | "unread";
    page: number;
  }>({ filter: "all", page: 0 });
  const { filter, page } = inbox;
  const readInFlight = useRef(false);
  const notificationsQuery = useNotifications(
    { page, unreadOnly: filter === "unread" },
    open,
  );
  const unreadQuery = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const busy = markRead.isPending || markAllRead.isPending;
  const notifications = notificationsQuery.data?.content ?? [];
  const unreadCount = unreadQuery.data?.unreadCount;
  const hasUnread =
    !unreadQuery.isError && unreadCount !== undefined && unreadCount > 0;
  const totalPages = notificationsQuery.data?.totalPages ?? 0;
  const totalElements = notificationsQuery.data?.totalElements ?? 0;

  // Polling/read-all can shrink an unread inbox while an older page is open.
  if (
    notificationsQuery.data &&
    !notificationsQuery.isError &&
    page > Math.max(0, totalPages - 1)
  ) {
    setInbox({ filter, page: Math.max(0, totalPages - 1) });
  }

  function changeFilter(filter: "all" | "unread") {
    markRead.reset();
    markAllRead.reset();
    setInbox({ filter, page: 0 });
  }
  async function openNotification(notification: AppNotification) {
    if (readInFlight.current) return;
    readInFlight.current = true;
    markRead.reset();
    markAllRead.reset();
    const revision = authStorage.getRevision();
    try {
      if (!notification.read) await markRead.mutateAsync(notification.id);
      if (
        browserSession.sync() ||
        revision !== authStorage.getRevision() ||
        authStorage.isLoggingOut()
      )
        return;
      setOpen(false);
      navigate(notification.targetPath);
    } catch {
      // The mutation exposes a visible, retryable error; keep the inbox open.
    } finally {
      readInFlight.current = false;
    }
  }
  async function readAll() {
    if (readInFlight.current) return;
    readInFlight.current = true;
    markRead.reset();
    markAllRead.reset();
    try {
      await markAllRead.mutateAsync();
    } catch {
      /* Error is rendered below. */
    } finally {
      readInFlight.current = false;
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (readInFlight.current) return;
        if (value) {
          markRead.reset();
          markAllRead.reset();
        }
        setOpen(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl"
          aria-label={
            unreadQuery.isError
              ? "Notifications (unread count unavailable)"
              : hasUnread
                ? `${unreadCount} unread notifications`
                : "Open notifications"
          }
        >
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-background bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {(unreadCount ?? 0) > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[24rem] max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <PopoverHeader className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <PopoverTitle>Notifications</PopoverTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {unreadQuery.isError
                  ? "Unread count unavailable"
                  : unreadCount === undefined
                    ? "Checking unread updates..."
                    : hasUnread
                      ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                      : "You are all caught up"}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg"
              disabled={!hasUnread || busy}
              onClick={() => void readAll()}
            >
              <CheckCheck className="h-4 w-4" />
              {markAllRead.isPending ? "Marking read..." : "Read all"}
            </Button>
          </div>
        </PopoverHeader>

        <Separator />

        <div className="flex items-center gap-1 px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "secondary" : "ghost"}
            className="h-7 rounded-lg"
            aria-pressed={filter === "all"}
            disabled={busy}
            onClick={() => changeFilter("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "unread" ? "secondary" : "ghost"}
            className="h-7 rounded-lg"
            aria-pressed={filter === "unread"}
            disabled={busy}
            onClick={() => changeFilter("unread")}
          >
            Unread
          </Button>
        </div>

        {unreadQuery.isError && (
          <div role="alert" className="px-4 pb-2 text-sm text-destructive">
            Could not load the unread count.{" "}
            <Button
              variant="link"
              size="sm"
              disabled={unreadQuery.isFetching}
              onClick={() => void unreadQuery.refetch()}
            >
              Retry unread count
            </Button>
          </div>
        )}
        {(markRead.isError || markAllRead.isError) && (
          <p role="alert" className="px-4 pb-3 text-sm text-destructive">
            {requestError(
              markRead.error ?? markAllRead.error,
              "Could not mark notifications as read. Please try again.",
            )}
          </p>
        )}
        <div
          className="max-h-[28rem] overflow-y-auto p-2 pt-0"
          aria-busy={notificationsQuery.isFetching || busy}
        >
          {notificationsQuery.isError ? (
            <QueryFailure
              label="notifications"
              onRetry={notificationsQuery.refetch}
              pending={notificationsQuery.isFetching}
            />
          ) : notificationsQuery.isPending ? (
            <NotificationSkeleton />
          ) : notifications.length === 0 ? (
            <EmptyNotifications filter={filter} />
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  disabled={busy}
                  onOpen={() => void openNotification(notification)}
                />
              ))}
            </div>
          )}
        </div>
        {!notificationsQuery.isError && notificationsQuery.data && (
          <div className="space-y-2 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground" role="status">
              {totalElements} {filter === "unread" ? "unread " : ""}notification
              {totalElements === 1 ? "" : "s"}
              {totalPages > 0 ? ` · Page ${page + 1} of ${totalPages}` : ""}
            </p>
            {totalPages > 1 && (
              <div
                className="flex justify-between gap-2"
                aria-label="Notification pages"
              >
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Previous notifications"
                  disabled={page === 0 || busy || notificationsQuery.isFetching}
                  onClick={() => setInbox({ filter, page: page - 1 })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Next notifications"
                  disabled={
                    page + 1 >= totalPages ||
                    busy ||
                    notificationsQuery.isFetching
                  }
                  onClick={() => setInbox({ filter, page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notification,
  disabled,
  onOpen,
}: {
  notification: AppNotification;
  disabled: boolean;
  onOpen: () => void;
}) {
  const Icon = iconByType[notification.type];
  const eventLabel =
    (notification.eventType && eventLabels[notification.eventType]) ??
    toTitleCase(notification.type);

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className={cn(
        "group flex w-full gap-3 rounded-lg border border-transparent p-3 text-left transition hover:border-border hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !notification.read && "bg-primary/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground",
          !notification.read && "border-primary/40 text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {notification.title}
              </span>
              <span className="shrink-0 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {eventLabel}
              </span>
            </span>
            <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {notification.body}
            </span>
          </span>

          {!notification.read && (
            <span
              className="rounded-full p-1 text-primary opacity-100 transition hover:bg-primary/10 group-hover:opacity-100"
              aria-hidden="true"
            >
              <Circle className="h-2.5 w-2.5 fill-current" />
            </span>
          )}
        </span>

        <span className="mt-2 block text-[11px] text-muted-foreground">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-lg p-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyNotifications({ filter }: { filter: "all" | "unread" }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-3 text-sm font-medium">
        {filter === "unread"
          ? "No unread notifications"
          : "No notifications yet"}
      </div>
      <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-muted-foreground">
        {filter === "unread"
          ? "Everything in your inbox has been read."
          : "Task assignments, comments, project changes, and team updates will show up here."}
      </p>
    </div>
  );
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

import { ChevronDown, ChevronUp, Dot, MoveRight } from "lucide-react";
import { useState } from "react";

import {
  activityFormatter,
  getActivityTypeLabel,
  getActivityVerb,
} from "../../utils/activityFormatter";
import { formatDateTimeShort } from "../../utils/dateFormatter";

import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

import type { ProjectActivity } from "../../../features/projects/types/project.types";
import type { TeamActivity } from "../../../features/teams/types/team.type";
import type { TaskActivity } from "../../../features/tasks/types/task.types";

export type ActivityRecord = ProjectActivity | TeamActivity | TaskActivity;

export function ActivityItem({
  item,
  onOpenTask,
  interactive = true,
}: {
  item: ActivityRecord;
  onOpenTask?: (taskNumber: number) => void;
  interactive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const MAX_LENGTH = 220;
  const isLong = item.message.length > MAX_LENGTH;
  const formattedMessage = activityFormatter(item);
  const truncatedMessage = `${item.message.slice(0, MAX_LENGTH)}...`;
  const shouldTruncate = isLong && !expanded;
  const hasProject = "project" in item;
  const fullName = `${item.user.firstName} ${item.user.lastName}`.trim();
  const initials = `${item.user.firstName?.[0] ?? ""}${item.user.lastName?.[0] ?? ""}`;
  const activityTypeLabel = getActivityTypeLabel(item);
  const activityVerb = getActivityVerb(item);
  const showTypeBadge = activityTypeLabel !== "Comment";
  const primaryLabel =
    item.task?.title ??
    ("project" in item ? item.project?.title : null) ??
    ("details" in item ? item.details?.team?.label : null) ??
    "activity";
  const taskNumber = item.task?.taskNumber;
  const projectTitle = hasProject ? (item.project?.title ?? null) : null;
  const isInteractive =
    interactive && Boolean(onOpenTask) && Boolean(taskNumber);

  return (
    <article
      onClick={() => {
        if (isInteractive && onOpenTask && taskNumber) {
          onOpenTask(taskNumber);
        }
      }}
      onKeyDown={(e) => {
        if (
          (e.key === "Enter" || e.key === " ") &&
          isInteractive &&
          onOpenTask &&
          taskNumber
        ) {
          e.preventDefault();
          onOpenTask(taskNumber);
        }
      }}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={cn(
        "group relative flex gap-2.5 border-b border-border/50 py-1.5 last:border-b-0",
        isInteractive &&
          "cursor-pointer transition-colors duration-200 hover:bg-muted/20",
        isInteractive &&
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
      )}
    >
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-border/90" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-start gap-2.5">
              <Avatar size="sm" className="mt-0.5 h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
                  <span className="font-semibold text-foreground">
                    {fullName}
                  </span>
                  <span className="text-muted-foreground">{activityVerb}</span>
                  <span className="font-medium text-foreground">
                    {primaryLabel}
                  </span>
                  {showTypeBadge && (
                    <Badge
                      variant="outline"
                      className="h-4.5 rounded-md border-border/70 px-1.5 text-[9px] font-medium text-muted-foreground"
                    >
                      {activityTypeLabel}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  <span>{formatDateTimeShort(item.createdAt)}</span>
                  {projectTitle && (
                    <>
                      <Dot className="h-3 w-3" />
                      <span>{projectTitle}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pl-9 text-[13px] leading-5 text-muted-foreground">
              {shouldTruncate ? truncatedMessage : formattedMessage}
            </div>

            {isLong && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((prev) => !prev);
                }}
                className="ml-9 h-auto rounded-full px-0 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </Button>
            )}
          </div>

          {isInteractive && taskNumber && (
            <div className="hidden shrink-0 items-center md:flex">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">
                Open
                <MoveRight className="h-3 w-3" />
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

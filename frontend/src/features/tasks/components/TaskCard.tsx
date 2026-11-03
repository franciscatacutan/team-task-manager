import ArchiveBadge from "@/common/components/ArchiveBadge";
import PriorityBadge from "../../../common/components/PriorityBadge";
import { formatDate } from "../../../common/utils/dateFormatter";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Card, CardContent, CardFooter } from "../../../components/ui/card";
import { CalendarDays, CircleDashed, GripVertical } from "lucide-react";

import type { Task } from "../types/task.types";

interface Props {
  task: Task;
  onOpen: (task: Task) => void;
}

export default function TaskCard({ task, onOpen }: Props) {
  return (
    <Card
      onClick={() => onOpen(task)}
      className="group cursor-pointer rounded-xl border border-border/70 bg-background/96 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-background hover:shadow-md"
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <GripVertical className="h-3.5 w-3.5 opacity-55 transition-opacity group-hover:opacity-100" />
            <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 font-medium">
              #{task.taskNumber}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ArchiveBadge archived={Boolean(task.deletedAt || task.readOnly)} />
            <PriorityBadge priority={task.priority ?? "LOW"} />
          </div>
        </div>

        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
            {task.name}
          </h3>

          {task.description && (
            <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {task.plannedDueDate && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/25 px-2.5 py-1">
              <CalendarDays className="h-3 w-3" />
              Due {formatDate(task.plannedDueDate)}
            </span>
          )}

          {!task.plannedDueDate && task.plannedStartDate && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/25 px-2.5 py-1">
              <CalendarDays className="h-3 w-3" />
              Starts {formatDate(task.plannedStartDate)}
            </span>
          )}

          {!task.plannedDueDate && !task.plannedStartDate && (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/70 bg-muted/15 px-2.5 py-1">
              <CircleDashed className="h-3 w-3" />
              No schedule
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {task.assignedUser && (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-6 w-6 ring-1 ring-border/60">
                <AvatarFallback className="text-[10px]">
                  {task.assignedUser.lastName?.[0]}
                  {task.assignedUser.firstName?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                  Assignee
                </div>
                <div className="truncate text-[12px] font-medium text-foreground">
                  {task.assignedUser.firstName} {task.assignedUser.lastName}
                </div>
              </div>
            </div>
          )}

          {task.supportUser && (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-6 w-6 ring-1 ring-border/60">
                <AvatarFallback className="text-[10px]">
                  {task.supportUser.lastName?.[0]}
                  {task.supportUser.firstName?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                  Support
                </div>
                <div className="truncate text-[12px] font-medium text-foreground">
                  {task.supportUser.firstName} {task.supportUser.lastName}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {(task.plannedStartDate || task.plannedDueDate) && (
        <CardFooter className="flex flex-wrap gap-4 border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
          {task.plannedStartDate && (
            <span>Start: {formatDate(task.plannedStartDate)}</span>
          )}

          {task.plannedDueDate && (
            <span>Due: {formatDate(task.plannedDueDate)}</span>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

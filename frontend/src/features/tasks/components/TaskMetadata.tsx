import type { Task, UpdateTaskInput } from "../types/task.types";
import TeamMemberSelector from "../../teams/components/TeamMemberSelector";
import { useState } from "react";
import type { TaskPriority } from "../constants/task.constants";
import { taskMutationError } from "../utils/taskMutationError";

import { useAssignUser } from "../hooks/useAssignUser";
import { useAssignSupportUser } from "../hooks/useAssignSupportUser";
import PrioritySelect from "../../../common/components/PrioritySelector";
import { useUpdateTask } from "../hooks/useUpdateTask";
import DatePicker from "../../../common/components/DatePicker";
import StatusSelect from "../../../common/components/TaskStatusSelector";
import {
  TaskStatusLabel,
  TaskStatusStyles,
  type TaskStatus,
} from "../utils/task.constants";
import { useUpdateTaskStatus } from "../hooks/useUpdateTaskStatus";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { TaskPermissions } from "../utils/taskPermissions";
import { cn } from "../../../lib/utils";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLES,
} from "../constants/task.constants";

interface Props {
  permissions: TaskPermissions;
  teamKey: string;
  projectKey: string;
  task: Task;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 border-b border-border/50 py-2.5 last:border-b-0 first:pt-0 last:pb-0 sm:grid-cols-[5.75rem_minmax(0,1fr)] sm:items-center sm:gap-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 text-sm">{value}</div>
    </div>
  );
}

export default function TaskMetadata({
  permissions,
  teamKey,
  projectKey,
  task,
}: Props) {
  const [mutationError, setMutationError] = useState("");
  const mutationCallbacks = {
    onError: (error: unknown) => setMutationError(taskMutationError(error)),
  };
  const currentAssigneeId = task.assignedUser?.id;
  const currentSupportId = task.supportUser?.id;

  const assignUserMutation = useAssignUser(
    teamKey,
    projectKey,
    task.taskNumber,
  );

  const assignSupportUserMutation = useAssignSupportUser(
    teamKey,
    projectKey,
    task.taskNumber,
  );

  const updateTaskMutation = useUpdateTask(
    teamKey,
    projectKey,
    task.taskNumber,
  );

  function saveDetails(input: UpdateTaskInput) {
    setMutationError("");
    updateTaskMutation.mutate(input, mutationCallbacks);
  }

  function handleAssignUser(userId: string | null) {
    if (!userId || userId === currentAssigneeId) return;
    setMutationError("");
    assignUserMutation.mutate(userId, mutationCallbacks);
  }

  function handleAssignSupport(userId: string | null) {
    if (
      (!userId && !currentSupportId) ||
      userId === currentSupportId ||
      userId === currentAssigneeId
    )
      return;
    setMutationError("");
    assignSupportUserMutation.mutate(userId, mutationCallbacks);
  }

  function handleUpdatePriority(priority: TaskPriority) {
    if (!priority || priority === task.priority) return;
    saveDetails({
      priority,
    });
  }

  function handleUpdatePlannedStartDate(plannedStartDate: string | null) {
    if (!plannedStartDate || plannedStartDate === task.plannedStartDate) return;
    if (
      task.plannedDueDate &&
      new Date(plannedStartDate) > new Date(task.plannedDueDate)
    ) {
      saveDetails({
        plannedStartDate,
        plannedDueDate: plannedStartDate,
      });
      return;
    }

    saveDetails({
      plannedStartDate,
    });
  }

  function handleUpdatePlannedDueDate(plannedDueDate: string | null) {
    if (!plannedDueDate || plannedDueDate === task.plannedDueDate) return;
    saveDetails({
      plannedDueDate,
    });
  }

  const updateStatus = useUpdateTaskStatus(teamKey, projectKey);

  function handleStatusChange(taskNumber: number, status: TaskStatus) {
    setMutationError("");
    updateStatus.mutate({ taskNumber, status }, mutationCallbacks);
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-background p-4 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
      </div>

      {mutationError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {mutationError}
        </p>
      )}
      <div className="mt-2">
        <Row
          label="Status"
          value={
            permissions.canChangeStatus ? (
              <StatusSelect
                value={task.status}
                onChange={(status) =>
                  handleStatusChange(task.taskNumber, status)
                }
              />
            ) : (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                  TaskStatusStyles[task.status],
                )}
              >
                {TaskStatusLabel[task.status]}
              </span>
            )
          }
        />
        <Row
          label="Assignee"
          value={
            permissions.canAssign ? (
              <TeamMemberSelector
                key={"assignee"}
                teamKey={teamKey}
                value={currentAssigneeId}
                selectedUser={task.assignedUser}
                disabled={assignUserMutation.isPending}
                placeholder="Select assignee"
                excludedUserIds={currentSupportId ? [currentSupportId] : []}
                onChange={handleAssignUser}
              />
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-2">
                <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border/60">
                  <AvatarFallback className="text-[10px]">
                    {task.assignedUser?.lastName?.[0]}
                    {task.assignedUser?.firstName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-sm leading-5 text-foreground">
                  <span className="line-clamp-2 break-words">
                    {task.assignedUser?.firstName} {task.assignedUser?.lastName}
                  </span>
                </span>
              </span>
            )
          }
        />
        <Row
          label="Priority"
          value={
            permissions.canChangePriority ? (
              <PrioritySelect
                value={task.priority ?? "LOW"}
                onChange={(priority) => handleUpdatePriority(priority)}
              />
            ) : (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                  TASK_PRIORITY_STYLES[task.priority],
                )}
              >
                {TASK_PRIORITY_LABEL[task.priority]}
              </span>
            )
          }
        />
        <Row
          label="Support"
          value={
            permissions.canAssign ? (
              <TeamMemberSelector
                key={"support"}
                teamKey={teamKey}
                value={currentSupportId}
                selectedUser={task.supportUser}
                disabled={assignSupportUserMutation.isPending}
                placeholder="Select support"
                allowClear
                excludedUserIds={currentAssigneeId ? [currentAssigneeId] : []}
                onChange={handleAssignSupport}
              />
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-2">
                {task.supportUser ? (
                  <>
                    <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border/60">
                      <AvatarFallback className="text-[10px]">
                        {task.supportUser?.lastName?.[0]}
                        {task.supportUser?.firstName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 text-sm leading-5 text-foreground">
                      <span className="line-clamp-2 break-words">
                        {task.supportUser?.firstName}{" "}
                        {task.supportUser?.lastName}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="block min-w-0 truncate text-sm leading-5">
                    None
                  </span>
                )}
              </span>
            )
          }
        />

        <Row
          label="Planned Start Date"
          value={
            permissions.canChangeSchedule ? (
              <DatePicker
                value={
                  task.plannedStartDate
                    ? new Date(task.plannedStartDate)
                    : undefined
                }
                onChange={(date) =>
                  handleUpdatePlannedStartDate(date ? date.toISOString() : null)
                }
              />
            ) : (
              <span className="flex w-fit max-w-full flex-wrap items-center rounded-lg bg-muted/25 px-3 py-2 text-left text-muted-foreground">
                <CalendarIcon className="mr-2 h-4 w-4" />

                {task.plannedStartDate
                  ? format(task.plannedStartDate, "MMM dd, yyyy")
                  : "-"}
              </span>
            )
          }
        />
        <Row
          label="Planned Due Date"
          value={
            permissions.canChangeSchedule ? (
              <DatePicker
                value={
                  task.plannedDueDate
                    ? new Date(task.plannedDueDate)
                    : undefined
                }
                onChange={(date) =>
                  handleUpdatePlannedDueDate(date ? date.toISOString() : null)
                }
                disabled={(date) =>
                  task.plannedStartDate
                    ? date < new Date(task.plannedStartDate)
                    : false
                }
              />
            ) : (
              <span className="flex w-fit max-w-full flex-wrap items-center rounded-lg bg-muted/25 px-3 py-2 text-left text-muted-foreground">
                <CalendarIcon className="mr-2 h-4 w-4" />

                {task.plannedDueDate
                  ? format(task.plannedDueDate, "MMM dd, yyyy")
                  : "-"}
              </span>
            )
          }
        />

        <Row
          label="Actual Start Date"
          value={
            <span className="flex w-fit max-w-full flex-wrap items-center rounded-lg bg-muted/25 px-3 py-2 text-left text-muted-foreground">
              <CalendarIcon className="mr-2 h-4 w-4" />

              {task.actualStartDate
                ? format(task.actualStartDate, "MMM dd, yyyy")
                : "-"}
            </span>
          }
        />
        <Row
          label="Actual Due Date"
          value={
            <span className="flex w-fit max-w-full flex-wrap items-center rounded-lg bg-muted/25 px-3 py-2 text-left text-muted-foreground">
              <CalendarIcon className="mr-2 h-4 w-4" />

              {task.actualCompletionDate
                ? format(task.actualCompletionDate, "MMM dd, yyyy")
                : "-"}
            </span>
          }
        />
      </div>
    </section>
  );
}

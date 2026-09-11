import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Plus } from "lucide-react";

import type { Task } from "../types/task.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { formatDate } from "../../../common/utils/dateFormatter";
import { TaskStatusLabel, TaskStatusStyles } from "../utils/task.constants";
import { SortHeader } from "@/common/components/toolbar/SortHeader";
import type { SortField } from "@/common/types/sort.types";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLES,
} from "@/features/tasks/constants/task.constants";
import { Button } from "@/components/ui/button";

interface Props {
  tasks: Task[];
  isLoading?: boolean;
  teamKey: string;
  projectKey: string;
  onCreateTask?: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  canCreateTask: boolean;

  sortField: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const SORT_COLUMNS = [
  ["taskNumber", "Task #"],
  ["name", "Name"],
  ["priority", "Priority"],
  ["status", "Status"],
  ["assignee", "Assignee"],
  ["support", "Support"],
  ["plannedStartDate", "Start"],
  ["plannedDueDate", "Due"],
  ["createdAt", "Created"],
  ["lastActivityAt", "Last Activity"],
];

export default function TaskList({
  tasks,
  isLoading,
  teamKey,
  projectKey,
  onCreateTask,
  onClearFilters,
  hasActiveFilters,
  canCreateTask,
  sortField,
  sortOrder,
  onSort,
}: Props) {
  const navigate = useNavigate();

  function openTask(taskId: string) {
    navigate(`/teams/${teamKey}/projects/${projectKey}/tasks/${taskId}`);
  }

  return (
    <>
      {isLoading ? (
        <div className="flex flex-col">
          <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <TableRow className="hover:bg-transparent">
                  {SORT_COLUMNS.map(([field, label]) => (
                    <TableHead
                      key={field}
                      className="cursor-pointer select-none"
                    >
                      <span className="inline-flex items-center gap-2">
                        {label}
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent ">
                    {SORT_COLUMNS.map(([key]) => (
                      <TableCell key={key} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded-md bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : tasks.length > 0 ? (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex flex-1 overflow-auto rounded-2xl border border-border/60 bg-background shadow-sm">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <TableRow className="hover:bg-transparent">
                  {SORT_COLUMNS.map(([field, label]) => (
                    <SortHeader
                      label={label}
                      field={field as SortField}
                      sortField={sortField}
                      order={sortOrder}
                      onSort={onSort}
                    />
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    onClick={() => openTask(task.id)}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="px-4 py-3">
                      <div className="truncate text-muted-foreground">
                        {task.taskNumber}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="max-w-72 font-medium truncate group-hover:text-primary transition-colors">
                        {task.title}
                      </div>
                      <div className="mt-1 max-w-96 truncate text-xs text-muted-foreground">
                        {task.description?.trim() || "No description"}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${TASK_PRIORITY_STYLES[task.priority]}`}
                      >
                        {TASK_PRIORITY_LABEL[task.priority]}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${TaskStatusStyles[task.status]}`}
                      >
                        {TaskStatusLabel[task.status]}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="truncate text-muted-foreground">
                        {task.assignedUser?.firstName}{" "}
                        {task.assignedUser?.lastName}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="truncate text-muted-foreground">
                        {task.supportUser
                          ? `${task.supportUser.firstName} ${task.supportUser.lastName}`
                          : "-"}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(task.plannedStartDate)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(task.plannedDueDate)}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(task.createdAt)}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(task.lastActivityAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/75 px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            {hasActiveFilters ? "No matching tasks" : "No tasks yet"}
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Try clearing the search or filters to see more tasks."
              : "Create a task to start tracking work in this project."}
          </p>

          {hasActiveFilters ? (
            <Button
              variant="outline"
              className="mt-6 rounded-xl"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : canCreateTask ? (
            <Button className="mt-6 rounded-xl" onClick={onCreateTask}>
              <Plus className="h-4 w-4" />
              Create task
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}

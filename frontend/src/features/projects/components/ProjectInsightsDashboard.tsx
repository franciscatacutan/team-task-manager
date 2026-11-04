import QueryFailure from "@/common/components/QueryFailure";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  ListChecks,
  TimerReset,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { formatDate } from "../../../common/utils/dateFormatter";
import { cn } from "../../../lib/utils";
import type { ProjectInsights } from "../types/projectInsights.types";
import {
  ProjectStatusLabel,
  ProjectStatusStyles,
} from "../utils/project.constants";

interface Props {
  insights?: ProjectInsights;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => unknown;
}

const numberFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
});

const taskSegments = [
  { key: "todo", label: "To Do", className: "bg-slate-400" },
  { key: "inProgress", label: "In Progress", className: "bg-sky-500" },
  { key: "inReview", label: "In Review", className: "bg-violet-500" },
  { key: "onHold", label: "On Hold", className: "bg-amber-500" },
  { key: "done", label: "Done", className: "bg-emerald-500" },
  { key: "cancelled", label: "Cancelled", className: "bg-rose-500" },
] as const;

const formatNumber = (value: number) => numberFormatter.format(value);
const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;
const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

export default function ProjectInsightsDashboard({
  insights,
  isLoading,
  isError,
  onRetry,
}: Props) {
  if (isLoading) {
    return (
      <Card className="border-border/60 bg-background/92">
        <CardHeader>
          <CardTitle className="text-base">Project KPIs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl border border-border/60 bg-muted/30"
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError && onRetry)
    return <QueryFailure label="insights" onRetry={onRetry} />;
  if (isError || !insights) {
    return (
      <Card className="border-border/60 bg-background/92">
        <CardHeader>
          <CardTitle className="text-base">Project KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            Project insights are unavailable right now.
          </div>
        </CardContent>
      </Card>
    );
  }

  const openTasks = Math.max(
    0,
    insights.tasks.total - insights.tasks.done - insights.tasks.cancelled,
  );
  const urgentTasks =
    insights.tasks.highPriority + insights.tasks.criticalPriority;
  const taskCompletion = clampPercent(insights.flow.completionRatePercent);
  const dueSignal = getDueSignal(insights);
  const lastGenerated = new Date(insights.generatedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-linear-to-br from-background via-background to-muted/20 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Project KPIs
          </h2>
          <p className="text-sm text-muted-foreground">
            Delivery health, task flow, deadlines, and 7-day signals.
          </p>
        </div>

        <span className="text-xs text-muted-foreground">
          Generated {lastGenerated}
        </span>
      </div>

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="Completion"
          value={formatPercent(insights.flow.completionRatePercent)}
          detail={`${formatNumber(insights.flow.completedLast7Days)} tasks done in 7 days`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiTile
          title="Open tasks"
          value={formatNumber(openTasks)}
          detail={`${formatNumber(insights.tasks.total)} total project tasks`}
          icon={ListChecks}
          tone="sky"
        />
        <KpiTile
          title="Overdue"
          value={formatNumber(insights.tasks.overdue)}
          detail={`${formatNumber(urgentTasks)} high or critical priority`}
          icon={AlertTriangle}
          tone={insights.tasks.overdue > 0 ? "rose" : "slate"}
        />
        <KpiTile
          title="Cycle time"
          value={`${formatNumber(insights.flow.averageCycleTimeHours)}h`}
          detail="Average from completed tasks"
          icon={Clock3}
          tone="violet"
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="border-border/60 bg-background/92">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Task Flow</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="space-y-4">
            <ProgressSummary
              label="Tasks done"
              value={insights.tasks.done}
              total={insights.tasks.total}
              percent={taskCompletion}
              accentClassName="bg-emerald-500"
            />

            <div className="h-3 overflow-hidden rounded-full bg-muted">
              {taskSegments.map((segment) => {
                const value = insights.tasks[segment.key];
                const width =
                  insights.tasks.total === 0
                    ? 0
                    : (value / insights.tasks.total) * 100;

                return (
                  <div
                    key={segment.key}
                    className={cn("inline-block h-full", segment.className)}
                    style={{ width: `${width}%` }}
                  />
                );
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {taskSegments.map((segment) => (
                <MetricRow
                  key={segment.key}
                  label={segment.label}
                  value={insights.tasks[segment.key]}
                  markerClassName={segment.className}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/92">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Delivery Plan</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                  ProjectStatusStyles[insights.status],
                )}
              >
                {ProjectStatusLabel[insights.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DetailMetric
                label="Planned start"
                value={formatDate(insights.plannedStartDate)}
              />
              <DetailMetric
                label="Planned due"
                value={formatDate(insights.plannedDueDate)}
              />
              <DetailMetric
                label="Actual start"
                value={formatDate(insights.actualStartDate)}
              />
              <DetailMetric
                label="Completed"
                value={formatDate(insights.actualCompletionDate)}
              />
            </div>

            <div
              className={cn(
                "rounded-xl border px-3 py-2.5",
                dueSignal.className,
              )}
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <TimerReset className="h-3.5 w-3.5" />
                Schedule signal
              </div>
              <div className="mt-1 text-lg font-semibold">
                {dueSignal.label}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/60 bg-background/92">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Activity Signals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>

        <CardContent className="grid gap-2 sm:grid-cols-3">
          <DetailMetric
            label="Activity events"
            value={formatNumber(insights.activity.activityEventsLast7Days)}
            hint="Last 7 days"
          />
          <DetailMetric
            label="Audit logs"
            value={formatNumber(insights.activity.auditEventsLast7Days)}
            hint="Last 7 days"
          />
          <DetailMetric
            label="System events"
            value={formatNumber(insights.activity.systemEventsLast7Days)}
            hint="Last 7 days"
          />
        </CardContent>
      </Card>
    </section>
  );
}

function getDueSignal(insights: ProjectInsights) {
  if (insights.actualCompletionDate) {
    return {
      label: insights.health.completedOnTime
        ? "Completed on time"
        : "Completed late",
      className: insights.health.completedOnTime
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (!insights.plannedDueDate) {
    return {
      label: "No due date",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  if (insights.health.overdue) {
    return {
      label: `${Math.abs(insights.health.daysUntilDue)} days overdue`,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (insights.health.daysUntilDue === 0) {
    return {
      label: "Due today",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: `${insights.health.daysUntilDue} days remaining`,
    className: "border-sky-200 bg-sky-50 text-sky-700",
  };
}

function KpiTile({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "emerald" | "rose" | "sky" | "slate" | "violet";
}) {
  const toneClassName = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  }[tone];

  return (
    <Card className="border-border/60 bg-background/92">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {title}
            </p>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </div>
          </div>

          <div className={cn("rounded-xl border p-2", toneClassName)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ProgressSummary({
  label,
  value,
  total,
  percent,
  accentClassName,
}: {
  label: string;
  value: number;
  total: number;
  percent: number;
  accentClassName: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatNumber(value)} / {formatNumber(total)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", accentClassName)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {formatPercent(percent)} completion rate
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  markerClassName,
}: {
  label: string;
  value: number;
  markerClassName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", markerClassName)}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-semibold text-foreground">
        {formatNumber(value)}
      </span>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
      <div className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

import QueryFailure from "@/common/components/QueryFailure";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  ListChecks,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { cn } from "../../../lib/utils";
import type { TeamInsights } from "../types/teamInsights.types";

interface Props {
  insights?: TeamInsights;
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

export default function TeamInsightsDashboard({
  insights,
  isLoading,
  isError,
  onRetry,
}: Props) {
  if (isLoading) {
    return (
      <Card className="border-border/60 bg-background/92">
        <CardHeader>
          <CardTitle className="text-base">Team KPIs</CardTitle>
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
          <CardTitle className="text-base">Team KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            Team insights are unavailable right now.
          </div>
        </CardContent>
      </Card>
    );
  }

  const openTasks = insights.health.openTasks;
  const urgentTasks =
    insights.tasks.highPriority + insights.tasks.criticalPriority;
  const totalTasks = insights.tasks.total;
  const taskCompletion = clampPercent(insights.flow.completionRatePercent);
  const projectCompletion = clampPercent(
    insights.projects.completionRatePercent,
  );
  const lastGenerated = new Date(insights.generatedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-linear-to-br from-background via-background to-muted/20 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Team KPIs</h2>
          <p className="text-sm text-muted-foreground">
            Flow, workload, project health, and 7-day activity.
          </p>
        </div>

        <span className="text-xs text-muted-foreground">
          Generated {lastGenerated}
        </span>
      </div>

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="Task completion"
          value={formatPercent(insights.flow.completionRatePercent)}
          detail={`${formatNumber(insights.flow.completedLast7Days)} done in 7 days`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiTile
          title="Open workload"
          value={formatNumber(openTasks)}
          detail={`${formatNumber(insights.health.openTasksPerMember)} open per member`}
          icon={ListChecks}
          tone="sky"
        />
        <KpiTile
          title="Overdue tasks"
          value={formatNumber(insights.health.overdueTasks)}
          detail={`${formatNumber(urgentTasks)} high or critical priority`}
          icon={AlertTriangle}
          tone={insights.health.overdueTasks > 0 ? "rose" : "slate"}
        />
        <KpiTile
          title="Cycle time"
          value={`${formatNumber(insights.flow.averageCycleTimeHours)}h`}
          detail="Average from completed tasks"
          icon={Clock3}
          tone="violet"
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="border-border/60 bg-background/92">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Task Flow</CardTitle>
            </div>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="space-y-4">
            <ProgressSummary
              label="Tasks done"
              value={insights.tasks.done}
              total={totalTasks}
              percent={taskCompletion}
              accentClassName="bg-emerald-500"
            />

            <div className="h-3 overflow-hidden rounded-full bg-muted">
              {taskSegments.map((segment) => {
                const value = insights.tasks[segment.key];
                const width = totalTasks === 0 ? 0 : (value / totalTasks) * 100;

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
            <div>
              <CardTitle className="text-base">Portfolio</CardTitle>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="space-y-4">
            <ProgressSummary
              label="Projects completed"
              value={insights.projects.completed}
              total={insights.projects.total}
              percent={projectCompletion}
              accentClassName="bg-cyan-500"
            />

            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="Active" value={insights.projects.active} />
              <MiniMetric label="On hold" value={insights.projects.onHold} />
              <MiniMetric
                label="Done 7d"
                value={insights.projects.completedLast7Days}
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Active projects per member
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {formatNumber(insights.health.activeProjectsPerMember)}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="border-border/60 bg-background/92">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Membership</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric label="Total" value={insights.membership.total} />
            <MiniMetric label="Owners" value={insights.membership.owners} />
            <MiniMetric label="Admins" value={insights.membership.admins} />
            <MiniMetric label="Members" value={insights.membership.members} />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/92">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Activity Signals</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent className="grid grid-cols-3 gap-2">
            <MiniMetric
              label="Activity"
              value={insights.activity.activityEventsLast7Days}
            />
            <MiniMetric
              label="Audit"
              value={insights.activity.auditEventsLast7Days}
            />
            <MiniMetric
              label="System"
              value={insights.activity.systemEventsLast7Days}
            />
          </CardContent>
        </Card>
      </section>
    </section>
  );
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
      <div className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">
        {formatNumber(value)}
      </div>
    </div>
  );
}

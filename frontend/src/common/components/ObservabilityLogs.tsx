import type { ReactNode } from "react";
import {
  CalendarDays,
  ClipboardList,
  Dot,
  ServerCog,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import type {
  ObservabilityAuditLog,
  ObservabilitySystemEvent,
  ObservabilityUser,
  SystemEventSeverity,
} from "../types/observability.types";
import {
  activityFormatter,
  getActivityTypeLabel,
} from "../utils/activityFormatter";
import { formatDate, formatDateTimeShort } from "../utils/dateFormatter";

interface Props {
  title?: string;
  description: string;
  audit: {
    logs: ObservabilityAuditLog[];
    isLoading: boolean;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  system: {
    events: ObservabilitySystemEvent[];
    isLoading: boolean;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  sort: string;
  onSortChange: (sort: string) => void;
}

export default function ObservabilityLogs({
  title = "Operational Logs",
  description,
  audit,
  system,
  sort,
  onSortChange,
}: Props) {
  return (
    <Card className="border-border/60 bg-background/92">
      <CardHeader className="gap-3 space-y-0 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background shadow-none md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="occurredAt,desc">Newest first</SelectItem>
            <SelectItem value="occurredAt,asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="audit" className="space-y-3">
          <TabsList className="inline-flex h-auto gap-1 rounded-xl border border-border/60 bg-background/70 p-1 shadow-sm">
            <TabsTrigger
              value="audit"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ClipboardList className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ServerCog className="h-4 w-4" />
              System Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="m-0">
            <AuditLogList logs={audit.logs} isLoading={audit.isLoading} />
            <LogPagination
              page={audit.page}
              totalPages={audit.totalPages}
              onPageChange={audit.onPageChange}
            />
          </TabsContent>

          <TabsContent value="system" className="m-0">
            <SystemEventList
              events={system.events}
              isLoading={system.isLoading}
            />
            <LogPagination
              page={system.page}
              totalPages={system.totalPages}
              onPageChange={system.onPageChange}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function AuditLogList({
  logs,
  isLoading,
}: {
  logs: ObservabilityAuditLog[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LogSkeleton />;
  }

  if (logs.length === 0) {
    return (
      <EmptyLogState
        title="No audit logs yet"
        description="Write operations, status changes, and destructive actions will appear here."
      />
    );
  }

  return (
    <LogStream>
      {groupByDate(logs).map(([date, dateLogs]) => (
        <section key={date} className="space-y-2">
          <LogGroupHeader date={date} />

          <div className="space-y-0">
            {dateLogs.map((log) => (
              <LogRow
                key={log.id}
                actor={log.actor}
                occurredAt={log.occurredAt}
                markerClassName="bg-sky-500"
                icon={<ShieldCheck className="h-3.5 w-3.5 text-sky-700" />}
                badge={
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md border-sky-200 bg-sky-50 px-1.5 text-[10px] font-semibold text-sky-700"
                  >
                    {formatConstant(log.action)}
                  </Badge>
                }
                title={activityFormatter({
                  message: log.summary,
                  details: log.metadata,
                })}
                meta={[
                  formatConstant(log.entityType),
                  getActivityTypeLabel({
                    message: log.summary,
                  }),
                  log.projectKey ? `Project ${shortId(log.projectKey)}` : null,
                  log.taskNumber ? `Task ${shortId(log.taskNumber)}` : null,
                ]}
              />
            ))}
          </div>
        </section>
      ))}
    </LogStream>
  );
}

function SystemEventList({
  events,
  isLoading,
}: {
  events: ObservabilitySystemEvent[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LogSkeleton />;
  }

  if (events.length === 0) {
    return (
      <EmptyLogState
        title="No system events"
        description="Only high-signal operational events are recorded here."
      />
    );
  }

  return (
    <LogStream>
      {groupByDate(events).map(([date, dateEvents]) => (
        <section key={date} className="space-y-2">
          <LogGroupHeader date={date} />

          <div className="space-y-0">
            {dateEvents.map((event) => (
              <LogRow
                key={event.id}
                actor={event.actor}
                occurredAt={event.occurredAt}
                markerClassName={severityMarkerClassName(event.severity)}
                icon={
                  <TerminalSquare
                    className={cn(
                      "h-3.5 w-3.5",
                      severityIconClassName(event.severity),
                    )}
                  />
                }
                badge={
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 rounded-md px-1.5 text-[10px] font-semibold",
                      severityClassName(event.severity),
                    )}
                  >
                    {formatConstant(event.severity)}
                  </Badge>
                }
                title={activityFormatter({
                  message: event.message,
                  details: event.context,
                })}
                meta={[
                  event.category,
                  getActivityTypeLabel({
                    message: event.eventName,
                  }),
                  event.source,
                  event.projectKey
                    ? `Project ${shortId(event.projectKey)}`
                    : null,
                  event.taskNumber ? `Task ${shortId(event.taskNumber)}` : null,
                ]}
              />
            ))}
          </div>
        </section>
      ))}
    </LogStream>
  );
}

function LogStream({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-background/70 p-2">
      {children}
    </div>
  );
}

function LogGroupHeader({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {formatDate(date)}
      </h3>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function LogRow({
  actor,
  occurredAt,
  markerClassName,
  icon,
  badge,
  title,
  meta,
}: {
  actor: ObservabilityUser | null;
  occurredAt: string;
  markerClassName: string;
  icon: ReactNode;
  badge: ReactNode;
  title: ReactNode;
  meta: Array<string | null>;
}) {
  const cleanedMeta = meta.filter(Boolean) as string[];

  return (
    <article className="group relative flex gap-2.5 border-b border-border/50 py-2 last:border-b-0">
      <div
        className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", markerClassName)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2.5">
          <Avatar size="sm" className="mt-0.5 h-7 w-7 shrink-0">
            <AvatarFallback className="bg-muted text-[11px] font-semibold text-muted-foreground">
              {actorInitials(actor)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
              <span className="font-semibold text-foreground">
                {actorName(actor)}
              </span>
              <span className="text-muted-foreground">recorded</span>
              <span className="inline-flex h-5 items-center rounded-md border border-border/60 bg-muted/20 px-1.5">
                {icon}
              </span>
              {badge}
            </div>

            <p className="text-[13px] leading-5 text-foreground">{title}</p>

            <div className="flex flex-wrap items-center gap-y-1 text-[11px] text-muted-foreground">
              <span>{formatDateTimeShort(occurredAt)}</span>
              {cleanedMeta.map((item) => (
                <span key={item} className="inline-flex items-center">
                  <Dot className="h-3 w-3" />
                  <span className="rounded-md bg-muted/25 px-1.5 py-0.5">
                    {item}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function LogPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const isFirstPage = page === 0;
  const isLastPage = page + 1 >= totalPages;

  return (
    <footer className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
      <p className="text-sm text-muted-foreground">
        Page {page + 1} of {totalPages}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirstPage}
          className="rounded-xl"
        >
          Previous
        </Button>
        <Button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLastPage}
          className="rounded-xl"
        >
          Next
        </Button>
      </div>
    </footer>
  );
}

function LogSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-18 animate-pulse rounded-xl bg-muted/30"
        />
      ))}
    </div>
  );
}

function EmptyLogState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-6 py-8 text-center">
      <div className="mb-4 rounded-2xl bg-background p-4 shadow-sm">
        <CalendarDays className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function actorName(actor: ObservabilityUser | null) {
  if (!actor) {
    return "System";
  }

  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

function actorInitials(actor: ObservabilityUser | null) {
  if (!actor) {
    return "SY";
  }

  return `${actor.firstName?.[0] ?? ""}${actor.lastName?.[0] ?? ""}` || "?";
}

function formatConstant(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function groupByDate<T extends { occurredAt: string }>(items: T[]) {
  return Object.entries(
    items.reduce<Record<string, T[]>>((groups, item) => {
      const key = new Date(item.occurredAt).toDateString();

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(item);
      return groups;
    }, {}),
  );
}

function severityClassName(severity: SystemEventSeverity) {
  switch (severity) {
    case "CRITICAL":
      return "border-rose-300 bg-rose-50 text-rose-700";
    case "ERROR":
      return "border-red-300 bg-red-50 text-red-700";
    case "WARNING":
      return "border-amber-300 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function severityMarkerClassName(severity: SystemEventSeverity) {
  switch (severity) {
    case "CRITICAL":
      return "bg-rose-500";
    case "ERROR":
      return "bg-red-500";
    case "WARNING":
      return "bg-amber-500";
    default:
      return "bg-emerald-500";
  }
}

function severityIconClassName(severity: SystemEventSeverity) {
  switch (severity) {
    case "CRITICAL":
      return "text-rose-700";
    case "ERROR":
      return "text-red-700";
    case "WARNING":
      return "text-amber-700";
    default:
      return "text-emerald-700";
  }
}

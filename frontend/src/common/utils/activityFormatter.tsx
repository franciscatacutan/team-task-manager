import type { ActivityDetails, ActivityType } from "../types/activity.types";
import {
  isProjectStatus,
  ProjectStatusLabel,
  ProjectStatusStyles,
} from "../../features/projects/utils/project.constants";
import { TaskStatusStyles } from "../../features/tasks/utils/task.constants";

type ActivityLike = {
  message: string;
  type?: ActivityType;
  details?: Partial<ActivityDetails> | null;
};

function normalizeActivity(activity: string | ActivityLike): ActivityLike {
  if (typeof activity === "string") {
    return {
      message: activity,
      type: inferLegacyType(activity),
      details: inferLegacyDetails(activity),
    };
  }

  return {
    message: activity.message,
    type: activity.type ?? inferLegacyType(activity.message),
    details: activity.details ?? inferLegacyDetails(activity.message),
  };
}

export function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferLegacyType(message: string): ActivityType {
  if (message.startsWith("Created team ")) return "TEAM_CREATED";
  if (message.startsWith("Created project ")) return "PROJECT_CREATED";
  if (message.startsWith("Added ") && message.endsWith(" to the team"))
    return "TEAM_MEMBER_ADDED";
  if (message.startsWith("Removed ") && message.endsWith(" from the team"))
    return "TEAM_MEMBER_REMOVED";
  if (message.startsWith("Changed ") && message.includes(" role from "))
    return "TEAM_MEMBER_ROLE_CHANGED";
  if (message.startsWith("Transferred team ownership from "))
    return "TEAM_OWNERSHIP_TRANSFERRED";
  if (message.startsWith("Changed project status from "))
    return "PROJECT_STATUS_CHANGED";
  if (
    message.startsWith("Deleted project ") ||
    message.startsWith("Archived project ")
  )
    return "PROJECT_DELETED";
  if (
    message.startsWith("Deleted team ") ||
    message.startsWith("Archived team ")
  )
    return "TEAM_DELETED";
  if (message === "Task created") return "TASK_CREATED";
  if (message.startsWith("Created task ")) return "TASK_CREATED";
  if (message.startsWith("Task details updated")) return "TASK_UPDATED";
  if (message === "Task deleted") return "TASK_DELETED";
  if (
    message.startsWith("Deleted task ") ||
    message.startsWith("Archived task ")
  )
    return "TASK_DELETED";
  if (message.startsWith("Status changed from ")) return "TASK_STATUS_CHANGED";
  if (message.startsWith("Assignee changed from "))
    return "TASK_ASSIGNEE_CHANGED";
  if (message.startsWith("Support assigned to "))
    return "TASK_SUPPORT_ASSIGNED";
  if (message.startsWith("Support changed from "))
    return "TASK_SUPPORT_CHANGED";
  if (message.startsWith("Support removed (")) return "TASK_SUPPORT_REMOVED";
  return "TASK_COMMENTED";
}

function inferLegacyDetails(message: string): Partial<ActivityDetails> {
  const detailsMatch = message.match(/^Task details updated: (.+)$/);
  if (detailsMatch) {
    return {
      fields: detailsMatch[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };
  }

  const statusMatch = message.match(
    /^Status changed from ([A-Z_]+) to ([A-Z_]+)$/,
  );
  if (statusMatch) {
    return {
      from: statusMatch[1],
      to: statusMatch[2],
    };
  }

  const assigneeMatch = message.match(/^Assignee changed from (.+) to (.+)$/);
  if (assigneeMatch) {
    return {
      from: assigneeMatch[1],
      to: assigneeMatch[2],
    };
  }

  const supportAssignedMatch = message.match(/^Support assigned to (.+)$/);
  if (supportAssignedMatch) {
    return {
      target: supportAssignedMatch[1],
    };
  }

  const supportChangedMatch = message.match(
    /^Support changed from (.+) to (.+)$/,
  );
  if (supportChangedMatch) {
    return {
      from: supportChangedMatch[1],
      to: supportChangedMatch[2],
    };
  }

  const supportRemovedMatch = message.match(/^Support removed \((.+)\)$/);
  if (supportRemovedMatch) {
    return {
      from: supportRemovedMatch[1],
      target: supportRemovedMatch[1],
    };
  }

  return {};
}

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  TEAM_CREATED: "Created",
  TEAM_UPDATED: "Updated",
  TEAM_DELETED: "Archived",
  PROJECT_CREATED: "Created",
  PROJECT_UPDATED: "Updated",
  PROJECT_DELETED: "Archived",
  TEAM_MEMBER_ADDED: "Member",
  TEAM_MEMBER_REMOVED: "Member",
  TEAM_MEMBER_ROLE_CHANGED: "Role",
  TEAM_OWNERSHIP_TRANSFERRED: "Owner",
  PROJECT_STATUS_CHANGED: "Status",
  TASK_CREATED: "Created",
  TASK_UPDATED: "Updated",
  TASK_DELETED: "Archived",
  TASK_STATUS_CHANGED: "Status",
  TASK_ASSIGNEE_CHANGED: "Assignee",
  TASK_SUPPORT_ASSIGNED: "Support",
  TASK_SUPPORT_CHANGED: "Support",
  TASK_SUPPORT_REMOVED: "Support",
  TASK_COMMENTED: "Comment",
};

/** Structured event names never fall back to interpreting message text. */
export function getActivityEventLabel(eventType: string): string | undefined {
  return Object.hasOwn(ACTIVITY_TYPE_LABELS, eventType)
    ? ACTIVITY_TYPE_LABELS[eventType as ActivityType]
    : undefined;
}

export function getActivityTypeLabel(activity: string | ActivityLike): string {
  const { type = "TASK_COMMENTED" } = normalizeActivity(activity);
  return getActivityEventLabel(type) ?? "Comment";
}

export function getActivityVerb(activity: string | ActivityLike): string {
  const { type = "TASK_COMMENTED" } = normalizeActivity(activity);

  switch (type) {
    case "TEAM_CREATED":
      return "created";
    case "TEAM_UPDATED":
      return "updated";
    case "TEAM_DELETED":
      return "archived";
    case "TEAM_MEMBER_ADDED":
      return "added";
    case "TEAM_MEMBER_REMOVED":
      return "removed";
    case "TEAM_MEMBER_ROLE_CHANGED":
      return "changed";
    case "TEAM_OWNERSHIP_TRANSFERRED":
      return "transferred";
    case "PROJECT_CREATED":
      return "created";
    case "PROJECT_UPDATED":
      return "updated";
    case "PROJECT_DELETED":
      return "archived";
    case "PROJECT_STATUS_CHANGED":
      return "changed";
    case "TASK_CREATED":
      return "created";
    case "TASK_UPDATED":
      return "updated";
    case "TASK_DELETED":
      return "archived";
    case "TASK_STATUS_CHANGED":
      return "changed";
    case "TASK_ASSIGNEE_CHANGED":
      return "reassigned";
    case "TASK_SUPPORT_ASSIGNED":
      return "assigned";
    case "TASK_SUPPORT_CHANGED":
      return "updated";
    case "TASK_SUPPORT_REMOVED":
      return "removed";
    default:
      return "commented on";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "TODO":
      return TaskStatusStyles["TODO"];
    case "IN_PROGRESS":
      return TaskStatusStyles["IN_PROGRESS"];
    case "IN_REVIEW":
      return TaskStatusStyles["IN_REVIEW"];
    case "ON_HOLD":
      return TaskStatusStyles["ON_HOLD"];
    case "DONE":
      return TaskStatusStyles["DONE"];
    case "CANCELLED":
      return TaskStatusStyles["CANCELLED"];
    default:
      return "text-muted-foreground";
  }
}

function renderProjectStatus(status: string) {
  if (!isProjectStatus(status)) {
    return (
      <span className="font-medium text-foreground">
        {formatStatus(status)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${ProjectStatusStyles[status]}`}
    >
      {ProjectStatusLabel[status]}
    </span>
  );
}

export function activityFormatter(
  activity: string | ActivityLike,
): React.ReactNode {
  const normalized = normalizeActivity(activity);
  const type = normalized.type ?? "TASK_COMMENTED";
  const details = normalized.details ?? {};

  switch (type) {
    case "TEAM_CREATED":
      return details.team?.label ? (
        <>
          Created team{" "}
          <span className="font-medium text-foreground">
            {details.team.label}
          </span>
          .
        </>
      ) : (
        "Created this team."
      );

    case "TEAM_UPDATED": {
      const fields =
        details.changes?.map((change) => change.label ?? change.field) ??
        details.fields ??
        [];

      if (fields.length === 0) {
        return "Updated team details.";
      }

      return (
        <>
          Updated team{" "}
          <span className="font-medium text-foreground">
            {fields.join(", ")}
          </span>
          .
        </>
      );
    }

    case "TEAM_DELETED":
      return details.team?.label ? (
        <>
          Archived team{" "}
          <span className="font-medium text-foreground">
            {details.team.label}
          </span>
          .
        </>
      ) : (
        "Archived this team."
      );

    case "TEAM_MEMBER_ADDED":
      return (
        <>
          Added{" "}
          <span className="font-medium text-foreground">
            {details.subjectUser?.label ?? details.target ?? "a member"}
          </span>{" "}
          to the team.
        </>
      );

    case "TEAM_MEMBER_REMOVED":
      return (
        <>
          Removed{" "}
          <span className="font-medium text-foreground">
            {details.subjectUser?.label ?? details.target ?? "a member"}
          </span>{" "}
          from the team.
        </>
      );

    case "TEAM_MEMBER_ROLE_CHANGED":
      return (
        <>
          Changed{" "}
          <span className="font-medium text-foreground">
            {details.subjectUser?.label ?? "member"}
          </span>
          's role from{" "}
          <span className="font-medium text-foreground">
            {details.from ?? "unknown"}
          </span>{" "}
          to{" "}
          <span className="font-medium text-foreground">
            {details.to ?? "unknown"}
          </span>
          .
        </>
      );

    case "TEAM_OWNERSHIP_TRANSFERRED":
      return (
        <>
          Transferred ownership from{" "}
          <span className="font-medium text-foreground">
            {details.from ?? "previous owner"}
          </span>{" "}
          to{" "}
          <span className="font-medium text-foreground">
            {details.to ?? details.subjectUser?.label ?? "new owner"}
          </span>
          .
        </>
      );

    case "PROJECT_CREATED":
      return details.project?.label ? (
        <>
          Created project{" "}
          <span className="font-medium text-foreground">
            {details.project.label}
          </span>
          .
        </>
      ) : (
        "Created this project."
      );

    case "PROJECT_UPDATED": {
      const fields =
        details.changes?.map((change) => change.label ?? change.field) ??
        details.fields ??
        [];

      if (fields.length === 0) {
        return "Updated project details.";
      }

      return (
        <>
          Updated project{" "}
          <span className="font-medium text-foreground">
            {fields.join(", ")}
          </span>
          .
        </>
      );
    }

    case "PROJECT_DELETED":
      return details.project?.label ? (
        <>
          Archived project{" "}
          <span className="font-medium text-foreground">
            {details.project.label}
          </span>
          .
        </>
      ) : (
        "Archived this project."
      );

    case "PROJECT_STATUS_CHANGED":
      if (!details.from || !details.to) {
        return "Updated the project status.";
      }

      return (
        <>
          Changed the project status from {renderProjectStatus(details.from)} to{" "}
          {renderProjectStatus(details.to)}.
        </>
      );

    case "TASK_CREATED":
      return details.task?.label ? (
        <>
          Created task{" "}
          <span className="font-medium text-foreground">
            {details.task.label}
          </span>
          .
        </>
      ) : (
        "Created this task."
      );

    case "TASK_UPDATED": {
      const fields =
        details.changes?.map((change) => change.label ?? change.field) ??
        details.fields ??
        [];

      if (fields.length === 0) {
        return "Updated task details.";
      }

      return (
        <>
          Updated{" "}
          <span className="font-medium text-foreground">
            {fields.join(", ")}
          </span>
          .
        </>
      );
    }

    case "TASK_DELETED":
      return details.task?.label ? (
        <>
          Archived task{" "}
          <span className="font-medium text-foreground">
            {details.task.label}
          </span>
          .
        </>
      ) : (
        "Archived this task."
      );

    case "TASK_STATUS_CHANGED": {
      if (!details.from || !details.to) {
        return "Updated the task status.";
      }

      return (
        <>
          Moved this task from{" "}
          <span className={getStatusColor(details.from)}>
            {formatStatus(details.from)}
          </span>{" "}
          to{" "}
          <span className={getStatusColor(details.to)}>
            {formatStatus(details.to)}
          </span>
          .
        </>
      );
    }

    case "TASK_ASSIGNEE_CHANGED":
      if (!details.from || !details.to) {
        return "Changed the assignee.";
      }

      return (
        <>
          Reassigned this task from{" "}
          <span className="font-medium text-foreground">{details.from}</span> to{" "}
          <span className="font-medium text-foreground">{details.to}</span>.
        </>
      );

    case "TASK_SUPPORT_ASSIGNED":
      if (!details.target) {
        return "Assigned support.";
      }

      return (
        <>
          Assigned support to{" "}
          <span className="font-medium text-foreground">{details.target}</span>.
        </>
      );

    case "TASK_SUPPORT_CHANGED":
      if (!details.from || !details.to) {
        return "Changed support.";
      }

      return (
        <>
          Changed support from{" "}
          <span className="font-medium text-foreground">{details.from}</span> to{" "}
          <span className="font-medium text-foreground">{details.to}</span>.
        </>
      );

    case "TASK_SUPPORT_REMOVED":
      if (!details.target && !details.from) {
        return "Removed support.";
      }

      return (
        <>
          Removed support assignment for{" "}
          <span className="font-medium text-foreground">
            {details.target ?? details.from}
          </span>
          .
        </>
      );
    default:
      return normalized.message;
  }
}

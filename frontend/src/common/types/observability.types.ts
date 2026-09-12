import type {
  ActivityDetails,
  ActivityType,
} from "./activity.types";

export interface ObservabilityUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ObservabilityAuditLog {
  id: string;
  teamKey: string;
  projectKey?: string | null;
  taskNumber?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  eventType: ActivityType;
  actor: ObservabilityUser | null;
  summary: string;
  metadata?: Partial<ActivityDetails> | null;
  occurredAt: string;
}

export type SystemEventSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface ObservabilitySystemEvent {
  id: string;
  severity: SystemEventSeverity;
  category: string;
  eventName: string;
  source: string;
  teamKey: string;
  projectKey?: string | null;
  taskNumber?: string | null;
  message: string;
  actor: ObservabilityUser | null;
  context?: Partial<ActivityDetails> | null;
  occurredAt: string;
}

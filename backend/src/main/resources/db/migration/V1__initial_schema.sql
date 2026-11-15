-- Current v1 schema, reviewed against the Hibernate mappings at user commit 187d103.
-- Fresh databases only: existing unmanaged schemas require a separately reviewed adoption.
-- UUID generation, auditing timestamps and counters remain application responsibilities.
-- Applied migration files are immutable; append a new version for future changes.

CREATE TABLE activity_events (
  created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  entity_id UUID NOT NULL,
  id UUID NOT NULL,
  parent_entity_id UUID,
  project_id UUID,
  task_id UUID,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('TEAM', 'PROJECT', 'TASK')),
  parent_entity_type VARCHAR(50) CHECK (parent_entity_type IN ('TEAM', 'PROJECT', 'TASK')),
  event_type VARCHAR(80) NOT NULL CHECK (
    event_type IN (
      'TEAM_CREATED', 'TASK_CREATED', 'PROJECT_CREATED', 'TEAM_MEMBER_ADDED',
      'TEAM_MEMBER_REMOVED', 'TEAM_MEMBER_ROLE_CHANGED', 'TEAM_OWNERSHIP_TRANSFERRED', 'PROJECT_STATUS_CHANGED',
      'TASK_UPDATED', 'TASK_DELETED', 'TASK_STATUS_CHANGED', 'TASK_ASSIGNEE_CHANGED',
      'TASK_SUPPORT_ASSIGNED', 'TASK_SUPPORT_CHANGED', 'TASK_SUPPORT_REMOVED', 'TASK_COMMENTED',
      'PROJECT_DELETED', 'TEAM_DELETED', 'PROJECT_UPDATED', 'TEAM_UPDATED'
    )
  ),
  message TEXT NOT NULL,
  details_json jsonb NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE audit_logs (
  occurred_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  actor_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  id UUID NOT NULL,
  project_id UUID,
  task_id UUID,
  team_id UUID,
  action VARCHAR(50) NOT NULL CHECK (
    action IN (
      'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE',
      'ASSIGNMENT_CHANGE', 'COMMENT', 'MEMBERSHIP_CHANGE', 'OWNERSHIP_TRANSFER',
      'SYSTEM'
    )
  ),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('TEAM', 'PROJECT', 'TASK')),
  event_type VARCHAR(80) NOT NULL CHECK (
    event_type IN (
      'TEAM_CREATED', 'TASK_CREATED', 'PROJECT_CREATED', 'TEAM_MEMBER_ADDED',
      'TEAM_MEMBER_REMOVED', 'TEAM_MEMBER_ROLE_CHANGED', 'TEAM_OWNERSHIP_TRANSFERRED', 'PROJECT_STATUS_CHANGED',
      'TASK_UPDATED', 'TASK_DELETED', 'TASK_STATUS_CHANGED', 'TASK_ASSIGNEE_CHANGED',
      'TASK_SUPPORT_ASSIGNED', 'TASK_SUPPORT_CHANGED', 'TASK_SUPPORT_REMOVED', 'TASK_COMMENTED',
      'PROJECT_DELETED', 'TEAM_DELETED', 'PROJECT_UPDATED', 'TEAM_UPDATED'
    )
  ),
  summary TEXT NOT NULL,
  metadata_json jsonb NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE kpi_snapshots (
  target NUMERIC(19,4),
  value NUMERIC(19,4) NOT NULL,
  period_end TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  period_start TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  id UUID NOT NULL,
  scope_id UUID,
  scope VARCHAR(30) NOT NULL CHECK (scope IN ('GLOBAL', 'TEAM', 'PROJECT', 'TASK')),
  unit VARCHAR(40),
  kpi_key VARCHAR(120) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE metric_snapshots (
  value NUMERIC(19,4) NOT NULL,
  recorded_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  id UUID NOT NULL,
  scope_id UUID,
  scope VARCHAR(30) NOT NULL CHECK (scope IN ('GLOBAL', 'TEAM', 'PROJECT', 'TASK')),
  unit VARCHAR(40),
  metric_key VARCHAR(120) NOT NULL,
  dimensions_json jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE notifications (
  created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  read_at TIMESTAMP(6) WITH TIME ZONE,
  activity_event_id UUID,
  actor_id UUID,
  id UUID NOT NULL,
  project_id UUID,
  recipient_id UUID NOT NULL,
  task_id UUID,
  team_id UUID,
  type VARCHAR(30) NOT NULL CHECK (type IN ('TEAM', 'PROJECT', 'TASK')),
  title VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  target_path VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE projects (
  actual_completion_date TIMESTAMP(6) WITH TIME ZONE,
  actual_start_date TIMESTAMP(6) WITH TIME ZONE,
  created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP(6) WITH TIME ZONE,
  last_activity_at TIMESTAMP(6) WITH TIME ZONE,
  next_task_number BIGINT NOT NULL,
  planned_due_date TIMESTAMP(6) WITH TIME ZONE,
  planned_start_date TIMESTAMP(6) WITH TIME ZONE,
  status_changed_at TIMESTAMP(6) WITH TIME ZONE,
  updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  version BIGINT NOT NULL,
  completed_by UUID,
  created_by UUID,
  deleted_by UUID,
  id UUID NOT NULL,
  owner_id UUID NOT NULL,
  team_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'DELETED')),
  project_key VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(2000),
  PRIMARY KEY (id),
  CONSTRAINT uk_project_key UNIQUE (project_key)
);

CREATE TABLE refresh_tokens (
  created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP(6) WITH TIME ZONE,
  revoked_at TIMESTAMP(6) WITH TIME ZONE,
  family_id UUID NOT NULL,
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_by_ip VARCHAR(64),
  replaced_by_token_hash VARCHAR(64),
  token_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(512),
  PRIMARY KEY (id),
  CONSTRAINT uk_refresh_token_hash UNIQUE (token_hash)
);

CREATE TABLE system_events (
  occurred_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  actor_id UUID,
  id UUID NOT NULL,
  project_id UUID,
  task_id UUID,
  team_id UUID,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  category VARCHAR(80) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  source VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  context_json jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE tasks (
  actual_completion_date TIMESTAMP(6) WITH TIME ZONE,
  actual_start_date TIMESTAMP(6) WITH TIME ZONE,
  created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP(6) WITH TIME ZONE,
  last_activity_at TIMESTAMP(6) WITH TIME ZONE,
  planned_due_date TIMESTAMP(6) WITH TIME ZONE,
  planned_start_date TIMESTAMP(6) WITH TIME ZONE,
  status_changed_at TIMESTAMP(6) WITH TIME ZONE,
  task_number BIGINT NOT NULL,
  updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  version BIGINT NOT NULL,
  assignee_id UUID NOT NULL,
  completed_by UUID,
  created_by UUID,
  deleted_by UUID,
  id UUID NOT NULL,
  project_id UUID NOT NULL,
  support_id UUID,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(2000),
  priority VARCHAR(255) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status VARCHAR(255) NOT NULL CHECK (
    status IN (
      'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'ON_HOLD',
      'DONE', 'CANCELLED', 'DELETED'
    )
  ),
  PRIMARY KEY (id),
  CONSTRAINT uk_task_project_number UNIQUE (project_id, task_number)
);

CREATE TABLE team_members (
  joined_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  version BIGINT NOT NULL,
  added_by UUID NOT NULL,
  id UUID NOT NULL,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(255) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  PRIMARY KEY (id),
  CONSTRAINT uk_teammember_team_user UNIQUE (team_id, user_id)
);

CREATE TABLE teams (
  created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP(6) WITH TIME ZONE,
  last_activity_at TIMESTAMP(6) WITH TIME ZONE,
  membership_changed_at TIMESTAMP(6) WITH TIME ZONE,
  owner_changed_at TIMESTAMP(6) WITH TIME ZONE,
  updated_at TIMESTAMP(6) WITH TIME ZONE,
  version BIGINT NOT NULL,
  created_by UUID,
  deleted_by UUID,
  id UUID NOT NULL,
  owner_id UUID NOT NULL,
  team_key VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(2000),
  PRIMARY KEY (id),
  CONSTRAINT uk_team_key UNIQUE (team_key)
);

CREATE TABLE users (
  created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  version BIGINT NOT NULL,
  id UUID NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
  PRIMARY KEY (id),
  CONSTRAINT uk_user_email UNIQUE (email)
);

CREATE INDEX idx_activity_team_created_at ON activity_events (team_id, created_at);

CREATE INDEX idx_activity_project_created_at ON activity_events (project_id, created_at);

CREATE INDEX idx_activity_task_created_at ON activity_events (task_id, created_at);

CREATE INDEX idx_activity_entity_created_at ON activity_events (entity_type, entity_id, created_at);

CREATE INDEX idx_audit_team_occurred_at ON audit_logs (team_id, occurred_at);

CREATE INDEX idx_audit_entity_occurred_at ON audit_logs (entity_type, entity_id, occurred_at);

CREATE INDEX idx_audit_actor_occurred_at ON audit_logs (actor_id, occurred_at);

CREATE INDEX idx_audit_action_occurred_at ON audit_logs (action, occurred_at);

CREATE INDEX idx_kpi_scope_period ON kpi_snapshots (scope, scope_id, period_start, period_end);

CREATE INDEX idx_kpi_key_period ON kpi_snapshots (kpi_key, period_start, period_end);

CREATE INDEX idx_metric_scope_recorded_at ON metric_snapshots (scope, scope_id, recorded_at);

CREATE INDEX idx_metric_key_recorded_at ON metric_snapshots (metric_key, recorded_at);

CREATE INDEX idx_notification_recipient_created ON notifications (recipient_id, created_at);

CREATE INDEX idx_notification_recipient_read ON notifications (recipient_id, read_at);

CREATE INDEX idx_project_team_deleted ON projects (team_id, deleted_at);

CREATE INDEX idx_project_team_name ON projects (team_id, name);

CREATE INDEX idx_project_team_status_due ON projects (team_id, status, planned_due_date, deleted_at);

CREATE INDEX idx_system_event_team_occurred_at ON system_events (team_id, occurred_at);

CREATE INDEX idx_system_event_name_occurred_at ON system_events (event_name, occurred_at);

CREATE INDEX idx_system_event_severity_occurred_at ON system_events (severity, occurred_at);

CREATE INDEX idx_task_project_deleted ON tasks (project_id, deleted_at);

CREATE INDEX idx_task_assignee_deleted ON tasks (assignee_id, deleted_at);

CREATE INDEX idx_task_team_status_due ON tasks (status, planned_due_date, deleted_at);

CREATE INDEX idx_teammember_team ON team_members (team_id);

CREATE INDEX idx_team_owner_id_deleted ON teams (owner_id, deleted_at);

CREATE INDEX idx_team_name ON teams (name);

CREATE INDEX idx_team_deleted ON teams (deleted_at);

CREATE INDEX idx_user_email ON users (email);

CREATE INDEX idx_user_role ON users (role);

ALTER TABLE activity_events
  ADD CONSTRAINT fk_activity_events_task_id
  FOREIGN KEY (task_id) REFERENCES tasks (id);

ALTER TABLE activity_events
  ADD CONSTRAINT fk_activity_events_user_id
  FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_logs_actor_id
  FOREIGN KEY (actor_id) REFERENCES users (id);

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_activity_event_id
  FOREIGN KEY (activity_event_id) REFERENCES activity_events (id);

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_actor_id
  FOREIGN KEY (actor_id) REFERENCES users (id);

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_recipient_id
  FOREIGN KEY (recipient_id) REFERENCES users (id);

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_completed_by
  FOREIGN KEY (completed_by) REFERENCES users (id);

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_created_by
  FOREIGN KEY (created_by) REFERENCES users (id);

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_deleted_by
  FOREIGN KEY (deleted_by) REFERENCES users (id);

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_owner_id
  FOREIGN KEY (owner_id) REFERENCES users (id);

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_team_id
  FOREIGN KEY (team_id) REFERENCES teams (id);

ALTER TABLE refresh_tokens
  ADD CONSTRAINT fk_refresh_tokens_user_id
  FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE system_events
  ADD CONSTRAINT fk_system_events_actor_id
  FOREIGN KEY (actor_id) REFERENCES users (id);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_assignee_id
  FOREIGN KEY (assignee_id) REFERENCES users (id);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_completed_by
  FOREIGN KEY (completed_by) REFERENCES users (id);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_created_by
  FOREIGN KEY (created_by) REFERENCES users (id);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_deleted_by
  FOREIGN KEY (deleted_by) REFERENCES users (id);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_project_id
  FOREIGN KEY (project_id) REFERENCES projects (id);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_support_id
  FOREIGN KEY (support_id) REFERENCES users (id);

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_added_by
  FOREIGN KEY (added_by) REFERENCES users (id);

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_team_id
  FOREIGN KEY (team_id) REFERENCES teams (id);

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_user_id
  FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_created_by
  FOREIGN KEY (created_by) REFERENCES users (id);

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_deleted_by
  FOREIGN KEY (deleted_by) REFERENCES users (id);

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_owner_id
  FOREIGN KEY (owner_id) REFERENCES users (id);

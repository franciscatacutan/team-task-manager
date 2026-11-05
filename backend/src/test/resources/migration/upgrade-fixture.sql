-- Synthetic upgrade records only; never loaded by application startup.

INSERT INTO users (id,first_name,last_name,email,password,role,created_at,updated_at,version)
VALUES ('00000000-0000-0000-0000-000000000001','Migration','Owner','migration@example.test','test-only-not-a-real-password-hash','SUPER_ADMIN','2026-01-02T03:04:05.123456Z','2026-01-02T03:04:05.123456Z',7);

INSERT INTO teams (id,owner_id,created_by,team_key,name,created_at,deleted_at,version)
VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','MIGRATION','Archived team','2026-01-02T03:04:05.123456Z','2026-01-02T03:04:05.123456Z',8);

INSERT INTO team_members (id,team_id,user_id,added_by,role,joined_at,version)
VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','OWNER','2026-01-02T03:04:05.123456Z',9);

INSERT INTO projects (id,team_id,owner_id,project_key,name,status,next_task_number,created_at,updated_at,deleted_at,version)
VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','MIGRATION-PROJECT','Archived project','ON_HOLD',42,'2026-01-02T03:04:05.123456Z','2026-01-02T03:04:05.123456Z','2026-01-02T03:04:05.123456Z',10);

INSERT INTO tasks (id,project_id,assignee_id,name,task_number,priority,status,created_at,updated_at,deleted_at,version)
VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Archived task',41,'CRITICAL','IN_REVIEW','2026-01-02T03:04:05.123456Z','2026-01-02T03:04:05.123456Z','2026-01-02T03:04:05.123456Z',11);

INSERT INTO refresh_tokens (id,user_id,token_hash,family_id,created_at,expires_at,revoked_at,replaced_by_token_hash)
VALUES ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','test-only-token-hash','00000000-0000-0000-0000-000000000006','2026-01-02T03:04:05.123456Z','2099-01-01T00:00:00Z','2026-01-02T03:04:05.123456Z','test-only-next-hash');

INSERT INTO activity_events (id,team_id,project_id,task_id,user_id,entity_type,entity_id,event_type,details_json,message,created_at)
VALUES ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','TASK','00000000-0000-0000-0000-000000000005','TASK_UPDATED','{"taskName":"Archived task","preserve":true}','Synthetic history','2026-01-02T03:04:05.123456Z');

INSERT INTO notifications (id,recipient_id,actor_id,activity_event_id,type,title,body,target_path,team_id,project_id,task_id,created_at,read_at)
VALUES ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000007','TASK','Synthetic notice','Preserve read state','/synthetic','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','2026-01-02T03:04:05.123456Z','2026-01-02T03:04:05.123456Z');

INSERT INTO audit_logs (id,actor_id,team_id,project_id,task_id,entity_type,entity_id,action,event_type,summary,metadata_json,occurred_at)
VALUES ('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','TASK','00000000-0000-0000-0000-000000000005','UPDATE','TASK_UPDATED','Synthetic audit','{"preserve":true}','2026-01-02T03:04:05.123456Z');

INSERT INTO system_events (id,actor_id,team_id,project_id,task_id,severity,category,event_name,source,message,context_json,occurred_at)
VALUES ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','INFO','DOMAIN','TASK_UPDATED','migration-test','Synthetic system event','{"preserve":true}','2026-01-02T03:04:05.123456Z');

INSERT INTO metric_snapshots (id,scope,scope_id,metric_key,value,unit,dimensions_json,recorded_at)
VALUES ('00000000-0000-0000-0000-000000000011','TEAM','00000000-0000-0000-0000-000000000002','synthetic.metric',123.4567,'count','{"preserve":true}','2026-01-02T03:04:05.123456Z');

INSERT INTO kpi_snapshots (id,scope,scope_id,kpi_key,value,target,unit,period_start,period_end)
VALUES ('00000000-0000-0000-0000-000000000012','PROJECT','00000000-0000-0000-0000-000000000004','synthetic.kpi',12.3456,99.9999,'percent','2026-01-02T03:04:05.123456Z','2026-01-03T03:04:05.123456Z');

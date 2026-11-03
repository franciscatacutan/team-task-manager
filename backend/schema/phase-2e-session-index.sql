-- Apply once to an existing PostgreSQL database before deploying Phase 2E.
-- Run directly (not inside a transaction): CONCURRENTLY avoids blocking normal writes.
-- The local Hibernate update profile creates the equivalent index automatically.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_session_active
    ON refresh_tokens (family_id, user_id, revoked_at, expires_at);

-- LEGACY reference for pre-Flyway databases only; do not run on the managed baseline.
-- Superseded by src/main/resources/db/migration/V2__refresh_session_lookup_index.sql.
-- Existing unmanaged database adoption is a separate reviewed operation.
-- Original Phase 2E instructions follow.
-- Run directly (not inside a transaction): CONCURRENTLY avoids blocking normal writes.
-- Hibernate update is retired; current local/prod startup uses Flyway plus validation.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_session_active
    ON refresh_tokens (family_id, user_id, revoked_at, expires_at);

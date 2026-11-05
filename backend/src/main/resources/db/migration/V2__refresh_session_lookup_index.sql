-- Version the session lookup index formerly delivered as a manual Phase 2E script.
-- This fresh-baseline path runs before the application accepts requests. A regular
-- transactional CREATE INDEX is intentional; live concurrent-index rollouts require
-- a separately reviewed nontransactional migration.
CREATE INDEX idx_refresh_session_active
  ON refresh_tokens (family_id, user_id, revoked_at, expires_at);

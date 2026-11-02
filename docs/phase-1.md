# Phase 1: correctness and security

Baseline: `628b31e5650af41f51190dfb6324f4666d302a5d`. Changes remain uncommitted for the user to review and commit.

## Changes

- Task lists resolve the project within the authorized team before querying by its internal ID. Forged team/project combinations return 404.
- Task names use `name` end to end: create/update requests, responses, frontend types, components, sorting, and task/project references in activity feeds. The temporary `title`/`name` adapter was removed at the user's request. Generic UI headings and notification titles remain separate concepts. Database columns already use `name`, so no data migration is needed.
- Notifications resolve team/project keys and task numbers, including existing inbox entries with stored UUID paths. Missing destinations fall back to the team-selection page.
- The API enforces the existing frontend workflow. DONE can reopen to IN_REVIEW or ON_HOLD; CANCELLED is terminal; DELETED can only be set by the archive operation.
- Refresh-token rejection commits expiry/reuse revocations. User-row locks serialize issuance, rotation, logout, and session revocation so concurrent refreshes cannot fork a family. Reusing a token fails closed and revokes its family, including a newly issued successor. Separate session families remain independent.
- Fixed hook dependencies and separated UI variant exports to make strict lint pass.
- Added Vitest/Testing Library tests and Spring-managed PostgreSQL Testcontainers integration tests; CI now runs tests instead of skipping them.
- Excluded host node_modules from frontend Docker builds.

## Verification

Run the commands in the root README. Backend tests cover actual HTTP authorization and persistence, forbidden team/project combinations, task updates, workflow, archiving, refresh expiry/reuse, rollback of unrelated failures, and concurrent rotation. Notification tests cover new and existing routes. Frontend tests cover editing through the component/API client, read-only behavior, partial updates, and activity display/search/grouping by name. The task response and activity-summary JSON fields changed from `title` to `name`; deploy both frontend and backend together.

No application data reset or schema migration is part of this phase. Only disposable integration-test databases are created.

## Follow-up work requiring approval

- Dependency hygiene (historical Phase 1 snapshot; superseded by [Phase 2A](phase-2a.md)): npm audit reported 36 advisories (1 critical, 23 high, 10 moderate, 2 low). The critical proxy-addr dependency is reached through the existing shadcn CLI -> MCP SDK -> Express chain. Review unused packages, CLI placement, and compatible patched versions before upgrading; do not use a blanket force fix.
- Versioned database migrations and explicit archive/read policies.
- Remaining permissions, pagination, assignment clearing, board/cache behavior, and API-contract consistency.
- Module boundaries, formatting conventions, UI/UX, bundle size, deployment, and broader production hardening remain later phases.

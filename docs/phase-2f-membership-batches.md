# Phase 2F: reliable partial-success member changes

Approved policy: process each member independently, retain successful changes, report failures, and retry only unsuccessful selections. Baseline: `5c534ea` (`fix: revoke access sessions immediately on logout and password reset`).

## Resulting behavior

Adding/removing three users can produce two committed successes and one failed entry. That failure does not undo the other users' changes or poison the next transaction. Each individual change remains atomic: its membership update, activity, audit, metrics, and notifications succeed or roll back together.

The coordinator records success only after the individual transaction commits. Authorization and active-team state are checked initially and reloaded for every entry. Team-row locking serializes concurrent member changes within the team. Existing ownership/admin policies remain in place, including owner protection and the narrow super-admin role/ownership exception.

Add, bulk-remove, and single-remove dialogs now inspect the response body. Partial/all-failed results remain visible instead of closing as though every operation succeeded. Successful entries leave the selection; failed names and chosen roles remain available after list refreshes. Retrying a known partial response sends only the unsuccessful selections. Closing/reopening a dialog resets its previous local result and selections.

Transport failures cannot confirm which entries committed. The UI preserves the selection and asks the user to refresh/check the member list before retrying. Member-dependent caches are refreshed on failed requests too. This phase does not add automatic mutation retries or claim exactly-once delivery across a lost network response.

## API contract

Existing routes/statuses remain: `POST /api/teams/{teamKey}/members` returns 201, and `DELETE` on the same path returns 200 for processed batches. These statuses do not imply every item succeeded. The response contains `success` and `failed`; an all-failed processed batch has an empty success list and explicit failures.

- Add successes retain the existing member summaries; remove successes contain user UUIDs.
- Each failure contains `userId`, safe human-readable `reason`, and the new additive `code`.
- Domain errors use existing API error codes such as `FORBIDDEN`, `CONFLICT`, and `NOT_FOUND`.
- Unexpected database/commit/runtime failures return `MEMBER_CHANGE_FAILED` with a generic retry message. SQL/provider details stay out of the response; the server logs the failure for diagnosis.
- Invalid whole requests, including duplicate IDs and null entries, are rejected before any member changes. This avoids contradictory success/failure entries for the same person. Empty/malformed requests continue to use request validation.
- Initial authorization/team lookup failures remain request-level errors. A permission change discovered between entries becomes a failure for later entries rather than permitting stale access.

Task assignee/support history and previous inbox records are retained when membership is removed. No automatic task reassignment, user deletion, new global permissions, dependency upgrades, or schema changes are introduced.

## Implementation and customization points

Backend paths below are relative to `backend/src/main/java/com/example/task_manager/`:

- `team/TeamMembershipService.java`: batch coordination and safe failure mapping. It uses `NOT_SUPPORTED` so the normal HTTP batch holds no outer transaction across entries.
- `team/TeamMemberOperations.java`: separate Spring bean with `REQUIRES_NEW` entry operations. Membership, activity, observability and notification writes participate in the same entry transaction. Cross-bean calls ensure transaction interception applies; failures are caught after rollback/commit handling, outside the entry transaction.
- `team/TeamRepository.java`: locked team lookup for each entry.
- `team/TeamMemberMapper.java`: shared member-response mapping for reads, roles/ownership, and additions.
- `team/TeamService.java`: old batch loops and duplicated mapping/add helpers are removed; unrelated team use cases remain here.
- `config/security/Authorization/TeamAuthorizationService.java`: the existing owner/super-admin role-administration policy is shared by both the new addition operation and existing role/ownership methods.
- `team/TeamController.java`: routes add/remove requests to the dedicated membership service.
- `team/dto/FailedMember.java`, `AddTeamMembersRequest.java`, and `RemoveTeamMembersRequest.java`: failure code and null-entry validation.

To customize permissions, update the shared policy and entry operations together with role-matrix tests. To change batch semantics, start with the coordinator and transaction boundaries; changing only a catch block cannot provide reliable partial commits. Retain result reporting after commit, not after a flush alone.

Frontend paths are relative to `frontend/src/`:

- `features/teams/types/team.type.ts` and `api/teamMemberApi.ts`: real add/remove batch response types replace the incorrect single-member/void return types.
- `features/teams/components/AddMemberForm.tsx`, `RemoveMemberModal.tsx`, and `RemoveMultiMemberModal.tsx`: failure feedback, retained unsuccessful selections, explicit retries, pending controls, and clean dialog state.
- `features/teams/components/MemberBatchFeedback.tsx`: shared success/failure counts and per-person reasons. Customize result copy here.
- `features/teams/components/AddMembersModal.tsx`: mounts the form while open, resets on reopening, and reports candidate-list loading failures with retry.
- `common/components/MultiUserSelector.tsx`: optional retained selected-user records keep names visible when current search/results change; optional disabled state prevents pending-selection edits. Existing callers can continue using the original props.
- `features/teams/utils/memberBatchError.ts`: safe request-level error text and uncertain-completion guidance.
- `features/teams/utils/invalidateMembership.ts`: shared refresh of team/member/available-user lists, current team role, affected user profiles, activity, audit, and insights. Both mutation hooks call it on settlement, including network failures. General query-key redesign remains deferred.

The existing fixed-size member/available-user queries remain for a later complete-selection phase; retained selection labels do not remove their pagination limits.

## Verification

Verified on 2026-11-03:

- Backend `mvnw.cmd -B -ntp verify`: 174 tests, zero failures/errors/skips; package and formatting pass.
- Frontend `npm run test`: 106 tests across 21 files pass.
- Frontend `npm run lint -- --max-warnings 0`: pass.
- Frontend `npm run build`: TypeScript and Vite production build pass.
- Prettier format check and `git diff --check`: pass.
- Java 21 backend Docker build: pass (`team-task-manager-backend:membership-check`).
- Node 24/Linux frontend Docker build: pass (`team-task-manager-frontend:membership-check`).

The existing bundle-size warning remains (approximately 1.07 MB minified / 310 KB gzip). No dependency versions or development database data were changed.

New backend coverage: `TeamMembershipBatchIntegrationTest` has 21 cases. It uses real, fixture-scoped PostgreSQL triggers to force membership, activity, audit, and notification writes to fail. Tests assert that only the failed entry rolls back, other successes persist, no failed-entry audit/notification leaks remain, and SQL details do not reach the response. Additional cases cover mixed/all-failed results, unchanged role boundaries, duplicate/null input, permission changes between entries, and concurrent duplicate/different-user additions. Test triggers are removed after each case; the disposable PostgreSQL container is separate from development data.

New frontend coverage: `MemberBatchDialogs.test.tsx` exercises partial/all-failed results, retained failed names/roles after refresh, retry payloads, transport failures, complete success, dialog reset, and candidate-list retry. `MembershipCache.test.tsx` checks real QueryClient invalidation for application results and lost-response errors. `MultiUserSelector.test.tsx` verifies retained labels and disabled pending controls in the actual shared component.

No browser end-to-end or load benchmark is claimed. Existing bundle-size warning, general cache/contract cleanup, full selector pagination, and other module-review findings remain deferred.

The transaction design follows [Spring's documented independent transaction semantics](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html). Normal HTTP batches have no surrounding database transaction and process entries sequentially; they do not hold one batch-wide connection while allocating another for every entry.

## Remaining work

See the [production readiness roadmap](production-readiness-roadmap.md). This phase has three completed parts: transaction isolation, result/retry/cache behavior, and verification. Five estimated phases remain, with approximately three parts each; future scope still requires approval.

## Suggested user commit

`fix: isolate team member batches and report partial failures`

The assistant does not stage, commit, or push changes.

# Phase 2B: former-member access boundaries

Baseline: `4cefaab` on `refactor/production-readiness`. After the module-flow review, the user approved fixing former-member personal-task access and future confidential notifications, with regression tests. Changes remain unstaged and uncommitted for the user to review and commit.

## What changed and why

### Personal task reads

Previously, `/api/teams/{teamKey}/projects/{projectKey}/tasks/my-task` ignored both parent keys and returned assignments across projects. The `/project-task` variant used the project key but ignored the team key. Both trusted assignment records without checking current team membership, so a removed member could still obtain task data despite being denied by the normal detail endpoint.

Both existing URLs now resolve to the same project-scoped operation:

1. Resolve the requester from the authenticated identity.
2. Resolve an active team and a project belonging to that team.
3. Require current membership; missing membership returns 404, consistent with inaccessible project reads.
4. Query the requester's assignee/support tasks by the resolved project UUID, excluding archived tasks and parents and requiring membership in the database query as well.
5. Apply the existing task sort-field validation and pagination.

Public URLs continue using team/project keys. Internal queries use the resolved project UUID after validating its parent; neither URL was renamed or removed. The `my-task` alias is now explicitly restricted to the project in its URL. A future account-wide personal feed should have an account-wide route and its own agreed contract.

The redundant controller/service paths and the unscoped repository query were removed so the aliases cannot diverge again. There are no frontend callers of these personal-task endpoints in the current source. Task/project domain names remain `name`.

### Notification recipients

Previously, stale assignee, support, project-owner or project-creator references could keep selecting a removed member for new notifications, including comment previews.

Notification candidates now pass a current-membership check before a new inbox entry is stored. This applies to subject recipients as well as assignment/ownership recipients; a stale reference alone no longer grants notification eligibility.

The explicit `TEAM_MEMBER_REMOVED` notice may still reach its subject after their membership is deleted. Existing inbox entries remain available. Current members still receive team and cascading task archive notices: this eligibility check uses membership existence rather than requiring the team itself to remain active.

Actor exclusion and recipient deduplication remain in place. Existing global-admin read privileges on other endpoints are unchanged; this batch governs the scoped personal feed and targeted collaboration notifications.

## Files and customization points

| File                                                                                                       | Responsibility                                                                                |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `backend/src/main/java/com/example/task_manager/task/TaskController.java`                                  | Keep both public personal-task aliases and pass both parent keys.                             |
| `backend/src/main/java/com/example/task_manager/task/TaskService.java`                                     | Resolve scope, check membership and apply sort validation in `getMyTasks`.                    |
| `backend/src/main/java/com/example/task_manager/task/TaskRepository.java`                                  | Project-scoped assignment query with current-membership and archive conditions.               |
| `backend/src/main/java/com/example/task_manager/team/TeamMemberRepository.java`                            | Shared membership-existence query.                                                            |
| `backend/src/main/java/com/example/task_manager/notification/NotificationService.java`                     | `canReceiveActivity` defines recipient eligibility and the explicit removal-notice exception. |
| `backend/src/test/java/com/example/task_manager/task/FormerMemberAccessIntegrationTest.java`               | HTTP/persistence regression cases for personal-task reads.                                    |
| `backend/src/test/java/com/example/task_manager/notification/FormerMemberNotificationIntegrationTest.java` | Removal, historical inbox, future task/project updates and archive-notice regressions.        |
| `backend/src/test/java/com/example/task_manager/notification/NotificationServiceTest.java`                 | Existing route-generation test now supplies an eligible member.                               |

Change these rules only after agreeing on the corresponding product policy. In particular, do not add blanket exceptions for notification subjects or relax membership based on assignment history. If the permission model later changes, update the read gate, database predicate, recipient policy and regressions together.

No assignment/ownership records are rewritten and no historical inbox entries are purged. This batch adds no dependencies, schema migration, development database reset, module reorganization, frontend behavior change, or formatting sweep.

## Verification

The 18 new PostgreSQL/HTTP regression cases were run before the implementation: 14 failed and 4 passed, reproducing the leaks and scope violations. After the implementation, all 52 backend tests pass: zero failures, errors or skipped tests. Spotless verification, compilation and executable JAR packaging pass with Maven `verify`.

Coverage includes:

- Both personal-task URL aliases.
- Current assignee and support membership, with assignments in another accessible project excluded.
- Archived tasks and archived parent teams/projects.
- Missing/mismatched parent keys and nonmember access.
- Unauthenticated requests.
- Actual membership removal through the API, while preserving assignment history.
- Future task comment notifications and project owner/creator notifications after removal.
- Historical inbox entries, the removal notice and matching unread count.
- Continued task notifications for a current member and archive notices after a team is archived.

Tests use the existing Spring-managed disposable PostgreSQL 17 container and test profile. They do not use the development database or local bootstrap credentials. Local verification uses JDK 25 targeting Java 21. The backend Docker build verifies compilation and packaging on Java 21; it skips test execution, as before.

Commands:

```powershell
cd backend
.\mvnw.cmd -B -ntp verify
```

```powershell
docker build -t team-task-manager-backend:membership-access-check ./backend
```

The root documentation must also pass `npm run format:check` from `frontend`. Frontend application code was not changed, so its full test/build suite was not rerun for this backend-only batch.

## Remaining work requires approval

The module review's other findings remain separate: permission matrix alignment, password/session invalidation, archive semantics, task priority/status contracts, support clearing, query-key consistency, member selection, batch feedback, pagination/search and structural refactoring. Assignment handover during member removal is a separate policy decision; current membership is the access safeguard regardless of that decision.

Suggested commit message for the user:

```text
fix: revoke former-member task and notification access
```

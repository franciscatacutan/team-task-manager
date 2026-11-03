# Phase 2D: consistent archiving and archived reads

Approved scope: archive fixes only. Restoration remains a separate future phase. Baseline: `b5f30cd` (`fix: align team permissions and add super-admin ownership recovery`).

## Resulting behavior

Archiving records `deletedAt` and `deletedBy` independently of workflow status. For example, an `IN_PROGRESS` task stays `IN_PROGRESS` after archiving, and a `COMPLETED` project stays `COMPLETED`. Workflow timestamps, start/completion dates, completion actors, assignments, names, descriptions, and existing history remain intact.

An archived item is read-only. An archived parent also makes its descendants read-only. Team archiving continues to archive active projects and tasks; project archiving continues to archive active tasks. Newly archived children now record the person who initiated the cascade. Earlier archives retain their original timestamp and actor and do not receive duplicate archive events.

| Operation                                                                               | Authorization                                                     |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Read archived team/project/task details and history                                     | Global `ADMIN` / `SUPER_ADMIN`, or current team `OWNER` / `ADMIN` |
| Archive a team                                                                          | Current team `OWNER`                                              |
| Archive a project or task                                                               | Current team `OWNER` / `ADMIN`                                    |
| Edit, assign, change workflow/schedule, comment on, or archive an already archived task | Blocked, including for global administrators and team managers    |
| Restore                                                                                 | Not implemented in this phase                                     |

Ordinary members cannot read archived items, including their own earlier assignments. Former members remain blocked unless they have independent global-administrator viewing rights. The narrow super-admin recovery exception from Phase 2C does not expand archive or edit privileges.

## Backend changes and their purpose

- `task/TaskService.java`: task detail and history reads resolve existing parents, then enforce archive visibility. Mutation methods still require active team, project, and task records. Direct task archiving no longer overwrites status or `statusChangedAt`.
- `project/ProjectService.java`: direct project archiving preserves project status and `statusChangedAt`; cascaded tasks record `deletedBy`.
- `team/TeamService.java`: cascaded projects and tasks record `deletedBy`. Existing transaction boundaries and version checks remain in place.
- `task/TaskSpecification.java` and `project/ProjectSpecification.java`: Active/Archived/All filters account for archived ancestors as well as each item's own archive marker. Workflow filtering remains independent, so an archived `DONE` task can be found with `status=DONE&deletedFilter=DELETED`.
- `task/dto/TaskResponse.java`: adds `deletedAt`, `deletedBy` (a user summary or null), and `readOnly`. The last flag is true if the task, its project, or its team is archived.
- `project/dto/ProjectResponse.java`: adds `readOnly`, true if the project or its team is archived. The existing `deleted` field continues to describe the project's own marker.
- `activity/ActivityEventMessageBuilder.java`: new archive events say “Archived.” Existing event identifiers such as `TASK_DELETED` remain stable for audit/history and notification compatibility.

Backend paths above are relative to `backend/src/main/java/com/example/task_manager/`.

## Frontend changes and their purpose

- Task page/modal permissions now account for the task's own archive marker and backend `readOnly` flag. History remains available while edit, status, assignment, schedule, and comment controls are disabled or hidden.
- `features/projects/components/ProjectDetails.tsx` applies the same rules to archived projects and prevents archived cards from being dragged. Archived projects automatically request all tasks so the board/list does not appear empty because of the default Active filter. An open task-creation form closes if the project becomes read-only.
- Task read failures show an unavailable state instead of loading forever. Loading and failure states stay inside the task dialog so it can still be dismissed.
- `common/components/ArchiveBadge.tsx` provides a shared archive badge for team/project/task collection views and task headers. Archive state is visible separately from workflow status.
- Archive confirmations, headers, the Visibility filter, and activity rendering use “Archive/Archived.” Confirmation text explains the read-only result and preservation of status/history.
- `features/teams/components/TeamOverview.tsx` includes archived projects in recent projects when viewing an archived team.
- Archive mutation hooks refresh actual detail keys, affected descendants, history, audit feeds, and insights. This fixes earlier task/project invalidations that omitted parent keys. This phase does not replace the application's general query-key architecture.

Frontend paths above are relative to `frontend/src/`.

## Compatibility and existing test data

Existing HTTP `DELETE` endpoints, `deletedFilter=ACTIVE|DELETED|ALL`, `deletedAt`/`deletedBy` fields, and activity event identifiers are retained. The UI describes these soft-delete operations as archiving. There are no new dependencies or schema changes, and the development database is not reset or rewritten.

Older directly archived records may already contain workflow status `DELETED`. That value remains readable for compatibility; this phase does not guess its previous status. The UI displays “Previous status unavailable” alongside its archive marker. The task board has a corresponding column in Archived/All views so those records remain openable. `DELETED` is not offered as a workflow transition. Legacy “Deleted ...” history messages remain recognized and render as archive activity, without rewriting stored events.

Reconstructing previous statuses or missing archiver metadata from older history would require a separate, reviewed data migration. Future restoration also needs explicit rules about who can restore, which descendants return, independently archived children, removed assignees, name conflicts, and these older records.

## Where to customize the behavior

- Archive visibility: `GlobalAuthorizationService.canViewDeleted`, `TeamService.validateCanReadTeam`, `ProjectService.validateCanReadProject`, and `TaskService.validateCanReadTask`. Keep list/detail/history rules aligned and update the integration tests together.
- Archive/cascade behavior: the existing `deleteTeam`, `deleteProject`, and `deleteTask` service methods. Preserve workflow fields unless a separately approved policy changes this decision.
- Effective archive filtering: `ProjectSpecification.deletedFilter` and `TaskSpecification.deletedFilter`.
- Read-only controls: `getProjectPermissions` / `getTaskPermissions` and their callers in ProjectDetails, TaskDetails, and TaskModal. Backend checks remain authoritative.
- Labels: `ArchiveBadge`, the archive confirmation components, workflow label maps, `deletedFilter.types.ts`, and `activityFormatter.tsx`.
- Cache refreshes: `useDeleteTask.ts`, `useDeleteProject.ts`, and `UseDeleteTeam.ts`.

## Verification

Verified on 2026-11-03:

- Backend `mvnw.cmd -B -ntp verify`: 127 tests, zero failures/errors/skips; formatting and package pass.
- Frontend `npm run test`: 72 tests across 16 files pass.
- Frontend `npm run lint -- --max-warnings 0`: pass.
- Frontend `npm run build`: TypeScript and Vite production build pass.
- Prettier and `git diff --check`: pass.
- Backend Docker image: Java 21 build passes (`team-task-manager-backend:archive-check`).
- Frontend Docker image: Node 24/Linux build passes (`team-task-manager-frontend:archive-check`), including case-sensitive import resolution.

The existing Vite chunk-size warning remains: the main JavaScript bundle is approximately 1.06 MB minified / 309 KB gzip. Bundle splitting is deferred to a performance phase. No dependency versions changed.

New regression coverage:

- `ArchiveConsistencyIntegrationTest`: 48 cases covering workflow preservation, completion metadata, cascades, archive actors, earlier archives, role-based reads/history, every task mutation, parent-only archive markers, legacy values, and mismatched route parents. Uses disposable PostgreSQL 17, not the development database.
- `ArchiveViews.test.tsx`: task page/dialog read-only behavior, retained history, active editing, loading/failure states, and dialog dismissal.
- `ProjectArchive.test.tsx`: project/ancestor read-only behavior, archived task visibility, and board permission callbacks.
- `TaskBoardArchive.test.tsx`: preserved-status and legacy archived cards remain visible/openable; the previous-status column is absent from the active workflow board.
- `ArchiveCache.test.tsx`: real QueryClient invalidation behavior for archive operations and affected child/detail/history/insights keys.
- `ArchiveHistory.test.tsx`: both old and new archive messages remain recognizable.

No browser end-to-end, concurrency, or load suite is claimed by these checks. Restoration and the other module-review findings remain deferred.

## Suggested user commit

`fix: preserve workflow state and align archived access`

The assistant does not stage, commit, or push changes.

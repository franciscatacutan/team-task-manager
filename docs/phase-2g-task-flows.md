# Phase 2G: consistent task flows

Approved scope: complete task assignee/support selection, optional support removal, four priorities (LOW/MEDIUM/HIGH/CRITICAL), matching API/types/validation, and board filtering/movement. The user selected **1–100 characters after trimming** for task names. Baseline: `5b779a3` (`fix: isolate team member batches and report partial failures`).

## Behavior and reasons

1. **Complete assignment selection.** Task creation and task details now use a server-searched, paginated current-team-member picker instead of a fixed first page or a 1,000-person fetch. Opening the picker loads 20 choices; Load more fetches the next page. Search is debounced by 300 ms and supports backend name/email matching. Stable last-name/email sorting makes page traversal reliable. Selected labels remain visible while search results change, including retained former-member assignments; former members are not offered as new choices. The other assignment is excluded from choices, and API authorization remains authoritative. Load failures have a retry control.
2. **Optional support can actually be removed.** Selecting None in task metadata now sends a null relationship through the hook/API to a dedicated DELETE support endpoint. Assignee remains required. The existing service supplies permission checks, active-parent checks, audit/activity/notification behavior, and idempotent no-op handling. The existing PATCH assignment routes remain compatible. Assignment failures are visible in the task panel.
3. **One frontend priority definition.** Task models, badges, selects, and creation validation now share the four-value constants and type. Critical has a label/style and can be created and edited; the obsolete three-value type is removed. A missing creation priority displays a placeholder rather than displaying Low while the form has no selected value. Priority remains required.
4. **Matching task contracts.** The create schema trims names, accepts one character, rejects more than 100, and validates UUIDs, ISO timestamps, and distinct assignee/support. Backend request records normalize names before size validation, allowing surrounding whitespace around a valid 100-character name. Description/date constraints retain the backend rules. Task API functions now return actual typed task/activity/page responses; nullable fields and activity actor UUIDs match those responses. Partial updates still omit untouched fields.
5. **Consistent board/filter/workflow behavior.** Selecting multiple statuses renders every selected column once. Dropping onto an existing task resolves that card's column status rather than treating its numeric task number as a status. Same-column drops do nothing. Disallowed transitions show feedback; archived/read-only/terminal tasks and callers without permission cannot move tasks. The status selector offers the current status plus its permitted next states, including the existing DONE reopening choices; cancellation and legacy DELETED remain terminal.
6. **Keyboard movement and meaningful pagination.** The installed dnd-kit KeyboardSensor and sortableKeyboardCoordinates support Space to pick up, arrow keys to move, Space to drop, and Escape to cancel. Per-column Load more buttons complement scroll pagination. Failed column queries show retry instead of a false empty state. Board mode no longer runs the unused list query or displays list pagination; each board column continues to page independently.
7. **Local mutation refresh fixes.** Creation invalidates the actual scoped list and board keys. Status updates store the confirmed server response and refresh the affected task, lists, history, and insights. The old optimistic write targeted a key no screen observed; it is removed. Status mutation failures remain visible, and board movement is disabled while a status request is pending. General query-key/optimistic-update architecture belongs to Phase 2H.

## Files and customization

Backend files below are relative to `backend/src/main/java/com/example/task_manager/`:

- `task/TaskController.java`: new `DELETE /api/teams/{teamKey}/projects/{projectKey}/tasks/{taskNumber}/support` returns the updated TaskResponse (200). It removes a relationship, not the task. `TaskService.changeSupport` remains the single business operation.
- `task/dto/CreateTaskRequest.java` and `UpdateTaskDetailsRequest.java`: name normalization before validation. Change these and the frontend schema together when changing the name rule.
- `task/entity/TaskEntity.java` and `task/TaskService.java`: computed severity rank and validated public-sort translation. `all=true` now preserves validated sorting instead of discarding it.
- Existing `task/entity/TaskStatus.java`, `task/TaskService.java`, and authorization services remain the workflow/permission authority. No new global-admin editing exception is introduced.

Frontend files below are relative to `frontend/src/`:

- `features/tasks/constants/task.constants.ts`: priority values, labels, badge styles, and picker order. `types/createTaskSchema.ts` controls creation validation; `types/task.types.ts` and `api/taskApi.ts` control task contracts.
- `features/teams/hooks/useSelectableTeamMembers.ts`: page size, stable sort, query keys, cancellation, and next-page calculation. `components/TeamMemberSelector.tsx`: debounce interval, retained selection labels, query feedback, and assignment choices. `api/teamMemberApi.ts` adds typed responses, repeated sort values, and optional cancellation.
- `common/components/UserSelector.tsx`: shared search UI, retained labels, optional clear, loading/retry/load-more controls. Existing non-task callers keep their local-search behavior.
- `features/tasks/components/CreateTaskForm.tsx`, `CreateTaskModal.tsx`, and `TaskMetadata.tsx`: task picker wiring, validation/error display, clear-support handling, and reset on dialog reopening. `utils/taskMutationError.ts` controls safe fallback error copy.
- `common/components/PrioritySelector.tsx`, `PriorityBadge.tsx`, and `TaskStatusSelector.tsx`: shared priority/status presentation. Workflow choices use `features/tasks/utils/task.constants.ts`; keep that table aligned with the backend enum when deliberately changing workflow policy.
- `features/tasks/components/TaskBoard.tsx`: column selection, drop resolution/guards, keyboard sensor, feedback, and per-column pagination. `features/projects/components/ProjectDetails.tsx`: list/board query enablement, filter propagation, and status request feedback.
- `features/tasks/hooks/useCreateTask.ts` and `useUpdateTaskStatus.ts`: focused cache corrections. `useTasks.ts` accepts an optional enabled flag; `useInfiniteTasks.ts` keeps the multi-status input contract while querying each rendered column separately.

The implementation uses existing shadcn/Radix, TanStack Query, Zod, and dnd-kit dependencies. No dependency upgrades, database schema changes, data resets, restoration, or new workflow states are included.

## Verification

Verified on 2026-11-03:

- Backend `mvnw.cmd -B -ntp spotless:check verify`: **200 tests**, zero failures/errors/skips; formatting and packaging pass. Tests use disposable PostgreSQL 17 containers.
- Frontend `npm test`: **147 tests across 28 files** pass.
- Frontend strict ESLint, TypeScript/Vite production build, Prettier, and `git diff --check`: pass.
- Backend Java 21 and frontend Node 24/Linux Docker image builds: pass.

`TaskConsistencyIntegrationTest` adds 26 cases for all four priorities, ascending/descending severity sorting before pagination and in personal feeds/unpaged lists, rejection of the internal sort property, trimmed name boundaries, support clear/no-op behavior, owner/admin/member/global-role boundaries, archived parent/task rejection, assignment compatibility/conflicts, former-member notification exclusion, and member pagination/search beyond the first 20 records.

Frontend regressions exercise actual picker pagination/search/retry/clear/disabled states, retained labels, all four priorities and name/resolver constraints, form submission with a one-character name/Critical priority, support removal and API rejection feedback, typed API routes/filters, scoped cache invalidation, multiple board status filters, card-drop resolution, workflow/read-only guards, column retry, pagination, and real keyboard dragging/cancellation. The keyboard test uses real dnd-kit sensors with DOM geometry supplied by the test environment.

No full browser end-to-end, accessibility certification, load benchmark, or production deployment is claimed. The existing bundle warning remains (about 1.07 MB minified / 312 KB gzip). Broader cache consistency, error states outside these task flows, cross-tab sessions, directory privacy, notifications/activity pagination, structural/UI refinements, and release hardening remain in later approved phases. Other modules' fixed-size selectors are not silently rewritten by this task-specific change.

Implementation references: [TanStack infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries), [dnd-kit sortable keyboard support](https://dndkit.com/legacy/presets/sortable/overview/), and [Zod validation APIs](https://zod.dev/api).

The user also approved severity-based priority sorting: ascending **Low → Medium → High → Critical**, descending reverses it. The public `priority` parameter is mapped to a read-only computed rank in the query, so PostgreSQL sorts before pagination. Project lists (including `all=true`) and personal-task feeds share this behavior. The rank is not a stored column or accepted public sort field; no data migration is needed. Hibernate supplies the [derived formula mapping](https://docs.hibernate.org/stable/orm/javadocs/org/hibernate/annotations/Formula.html). Customize the CASE ranks in `TaskEntity.java` if the priority policy changes, alongside the frontend constants and backend enum. Formula values are used only for querying, not mutable entity state or response DTOs.

## Checkpoint

See the [remaining roadmap](production-readiness-roadmap.md). Phase 2G completes three parts: assignments/support, contracts, and board/workflow verification. Four estimated phases remain (2H–2K), approximately three parts each; approval is required before starting another phase.

Suggested user commit: `fix: align task assignments, contracts and board workflows`.

The assistant does not stage, commit, or push changes.

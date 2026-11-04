# Phase 2J part 1 — shared task view

Approved scope: consolidate duplicated task-page/dialog loading, permissions, read-only checks and content; clarify those module boundaries and verify both entry points. Baseline: user commit `de1ce01`. This checkpoint is implemented and verified, awaiting user review/commit.

## What changed and why

The full task page and the project-board/activity dialog now use one task view. A fix to loading, permissions or content therefore applies to both entry points. Existing task URLs, public project/team keys, task numbers, mutation/cache hooks and server policies remain in use.

```text
AppRoutes → pages/TaskDetailsPage (URL + workspace adapter)
ProjectDetails → TaskModal (dialog + explicit workspace read-only input)
                         ↓
                      TaskView
        identity validation → queries → permissions → states
                         ↓
                     TaskContent
       header / description / comment / history / metadata
```

| File (under `frontend/src`)                                        | Responsibility / customization point                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pages/TaskDetailsPage.tsx`                                        | Translates route params and the enclosing workspace's archive state into explicit task-view inputs. Replaces the former `features/tasks/components/TaskDetails.tsx`. Change route adaptation here.                                         |
| `features/tasks/components/TaskModal.tsx`                          | Owns dialog visibility, close/archive callbacks and the accessible dialog heading. Receives `isWorkspaceReadOnly` from the parent instead of reading route outlet context. Change dialog dimensions here.                                  |
| `features/tasks/index.ts`                                          | Public task-read UI entry: `TaskView`, `TaskModal` and `TaskScope`. Consumers use this entry; internal components import their direct dependencies. This does not reorganize every existing task feature.                                  |
| `features/tasks/types/task.types.ts`                               | Adds `TaskScope`: public `teamKey`, `projectKey`, `taskNumber`. These are routing identities, not persistence IDs. Existing task/project naming stays `name`.                                                                              |
| `features/tasks/components/TaskView.tsx`                           | One controller for task/membership queries, authenticated user context, existing permission calculation and read-only flags. Task identity keys the controller so editors, comments and metadata state reset when changing tasks.          |
| `features/tasks/components/TaskContent.tsx`                        | Shared loaded content assembled from existing task components. `presentation` preserves existing page/dialog spacing and scrolling differences. Change common content ordering/layout here; change a field in its existing leaf component. |
| `features/tasks/components/TaskViewState.tsx`                      | Shared loading, invalid-link, unavailable and retry presentation. Reuses the existing `QueryFailure` component.                                                                                                                            |
| `features/tasks/utils/taskView.ts`                                 | Shared scope validation and Axios 403/404 classification.                                                                                                                                                                                  |
| `features/tasks/hooks/useTask.ts`, `features/tasks/api/taskApi.ts` | Valid scopes only; pass TanStack Query's cancellation signal through Axios. Stop automatic retries for 403/404 while retaining manual retry. Transient reads retain the previous three-retry behavior.                                     |

`AppRoutes` now mounts the page adapter. `ProjectDetails` imports the dialog through the task feature entry and passes its existing combined team/project read-only flag explicitly. TaskView uses the existing auth context instead of decoding the token through the users API. Touched task API cross-module imports use the existing `@/` alias, and task type imports are grouped at the top.

## Visible behavior and safeguards

- Invalid task identities mount no task or membership queries. Closed dialogs mount no task view.
- Initial transient failures show a visible retry. During a transient refresh failure, the last loaded task remains visible with an explicit refresh-failure notice.
- A confirmed 403/404 hides cached task content and shows “Task unavailable.” Manual retry can recover if access returns; the UI does not repeatedly retry a denied/missing task automatically.
- If the membership query fails, cached membership cannot keep management/comment controls enabled. A separate permission retry is available. The backend continues to authorize every write.
- Switching team/project/task identity remounts task-local editors. Closing and reopening the dialog clears its draft. Pending detail requests consume the cancellation signal; TanStack cancels when no observer needs the query.
- The dialog now has a separate screen-reader heading (`Task #N`). Interactive task controls are no longer nested inside an HTML heading. Loading/error dialogs remain closeable.
- Current permission policy is preserved: actual team owners/admins manage active tasks; assigned/support members change status and comment; other members and global nonmembers read without those write permissions. Authorized archived tasks preserve history and remain read-only.

One test-only correction in `NotificationCenter.test.tsx` waits for asynchronous destination navigation before asserting the URL. The full concurrent suite exposed the previous immediate assertion as timing-dependent. Notification runtime code is unchanged.

## Verification

- **314 frontend tests in 37 files pass** (272 existing + 42 new shared-view regressions). New cases run through both page and dialog adapters and real TanStack task queries, covering permission roles, invalid identity, cached denied reads, manual retry, transient failures, failed membership, draft isolation, cancellation, closed dialogs, accessible heading and callback forwarding. Existing archive tests remain in place.
- TypeScript, ESLint with zero warnings, repository Prettier check and production build pass. The frontend Docker image builds successfully (`team-task-manager-frontend:phase2j1`).
- Native Edge probe uses the real app and leaf components with mocked APIs: page and dialog name saves, comments and history refresh, close/reopen draft reset, archived read-only page, denied read/manual retry, 1440px desktop and 390px mobile checks, and no uncaught page errors. Inspected page/dialog screenshots. Mobile dialog content scrolls to history and fits the viewport.
- Reproducible optional browser check: start Vite on `127.0.0.1:4187` with `VITE_API_URL=http://127.0.0.1:4187`, then run `node scripts/check-task-view.mjs <temporary Playwright installation directory>`. Set `TTM_TEST_BROWSER` to override the default Windows Edge path and `TTM_TEST_SCREENSHOTS` to an existing output directory. Playwright is not an application dependency.
- `git diff --check` passes. Git HEAD remains `de1ce01`; nothing is staged, committed or pushed.

No backend/schema/dependency change or development-data mutation was needed. Backend tests were not rerun for this frontend-only checkpoint; Phase 2I part 3's 312 passing backend application tests remain previous evidence. Browser APIs are mocked, so this is not full backend-to-browser end-to-end verification.

At 390px, the existing expanded workspace sidebar leaves the standalone task page a narrow content column. This is recorded for the broader workspace/responsive review in Phase 2J part 3; the task dialog itself fits and scrolls to history. The production build still reports the existing large-JavaScript-chunk warning. This checkpoint does not claim bundle optimization, full responsive/accessibility coverage or production readiness.

## Next checkpoint

Phase 2J part 2 is proposed: agree on shared modern UI patterns/components and apply them consistently. Part 3 covers broader responsive/accessibility and module usability review. Phase 2K remains release readiness. After this checkpoint, approximately **five unfinished parts** remain across **two phases (2J–2K)**. Future scope and design choices require approval.

Suggested user commit: `refactor: share task page and dialog view`.

# Phase 2J part 3 — comment and operational-log feedback

Baseline: user commit `a4bad9e`. The user approved this focused checkpoint and chose to lock the comment composer until posting settles. The user committed this verified checkpoint as `f495e3b`. Phase 2J part 3 remains in progress; the remaining roadmap estimate is four parts (2J3 and 2K1–3).

## Comment behavior

- Posting disables the textarea, Cancel and Post, keeps the actions visible, and guards against duplicate submissions from rapid clicks. A named textarea and busy state make the form's state available to assistive technology.
- Confirmed success clears the submitted draft and announces **Comment posted.** Empty/whitespace-only comments cannot be submitted; the existing 2,000-character limit and server payload remain unchanged.
- Failure preserves the draft, displays an inline alert associated with the textarea and offers **Retry comment**. Editing dismisses the previous error; Cancel intentionally discards the draft. No automatic mutation retry was added.
- A network failure uses the existing uncertain-outcome message: refresh the data before retrying. The existing mutation still refreshes task/history queries after settling. This checkpoint does not introduce server idempotency or promise exactly-once delivery after a lost response.
- Each task/account generation gets an independent composer. A late success from an old task/account cannot clear the new draft. The existing shared task view supplies this behavior to both the task page and task dialog.
- Only the composer is locked. Task navigation and closing the task dialog retain their existing behavior; leaving does not cancel a submitted server request or persist an unsent draft.
- The action row wraps on narrow screens while keeping the character count intact.

## Operational-log behavior

Team and project adapters now forward each query's error, fetching and retry state to the shared log view. Audit logs and system events remain independent queries with their existing endpoints, filters, sort and paging contracts.

- An unsuccessful request displays a stream-specific alert and Retry instead of claiming the history is empty. A confirmed empty response still displays the existing empty-history message.
- Retry refetches only that stream at the selected page/sort. Initial failed loads show an announced loading skeleton during retry; failed cached refreshes disable Retry while fetching. Successful data in the other tab remains available.
- A transient refresh failure can retain existing rows with an explicit **last loaded** notice. Cached rows are hidden after a 403/404 failure. Error states hide pagination until recovery.
- The sort selector now has an accessible name; loading skeletons have a status label and stream containers expose their busy state.

## Files to customize

| File                                                                     | Responsibility                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `frontend/src/features/tasks/components/TaskCommentForm.tsx`             | Draft lifecycle, submission guard, task/account identity and success/error wording                            |
| `frontend/src/common/components/AutoResizeTextareaForm.tsx`              | Pending lock, action visibility, accessible field/error association, retry label and responsive action layout |
| `frontend/src/common/components/ObservabilityLogs.tsx`                   | Shared stream feedback, cached-data rules, loading and sort labels                                            |
| `frontend/src/features/teams/components/TeamObservabilityLogs.tsx`       | Team query state and retry wiring                                                                             |
| `frontend/src/features/projects/components/ProjectObservabilityLogs.tsx` | Project query state and retry wiring                                                                          |

The existing `useCreateTaskComment`, `useAppMutation`, cache invalidation, log query hooks and API methods retain their contracts. No permission, notification/event delivery, schema, backend or dependency change was made.

## Verification

- **402 frontend tests in 44 files passed**, including 21 new cases. Coverage includes pending locks, duplicate clicks, draft retention/edit/cancel, explicit retry, uncertain network results, late task/account responses, both log adapters, independent failure/recovery, retained transient caches, hidden 403/404 caches, empty histories and retrying a failed later page.
- TypeScript, strict ESLint, full formatting check, production compilation, frontend Docker build and Git whitespace checks passed.
- `frontend/scripts/check-comment-log-feedback.mjs` runs the real app in headless Edge with synthetic HTTP fixtures; it never touches development data. It verifies locked posting, failure/retry/success in the mobile task page and desktop task dialog, plus independent audit/system failure/recovery in mobile team insights and desktop project insights (dark theme).
- **12 scoped axe scans passed** for the changed editor and operational-log surfaces. Existing avatar contrast failures were excluded and recorded; these results are not a full-application accessibility claim. Screenshots were visually inspected.
- The existing large-bundle warning remains. Backend tests were not rerun for this frontend-only checkpoint. Browser tests use mocked APIs, not a real backend/database end-to-end run.

Browser artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/phase2j3c`.

## Remaining work

Other approved-review findings still need separately agreed checkpoints: account/member/ownership dialogs, profile discoverability, broader accessibility/contrast and validation feedback, auth failure wording, operational context DTO alignment and the root error fallback. Phase 2K retains release migrations, deployment/recovery, security, real end-to-end and load verification. This checkpoint does not establish whole-application production readiness.

No files were staged, committed or pushed. Suggested user commit: `fix: improve comment and operational log failure feedback`.

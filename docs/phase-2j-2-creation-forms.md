# Phase 2J part 2 — consistent creation forms and dialogs

Approved scope: standardize team, project and task creation dialogs, connected field labels, validation feedback and save/cancel states using the existing shadcn components. Preserve business rules. Baseline: user commit `af7359b`. This checkpoint is implemented and verified, awaiting user review/commit.

The user explicitly selected this pending-request policy: keep the dialog open until the request settles, disable fields, Cancel, Close, Escape and backdrop dismissal; retain the draft after failure for retry. Confirmed success closes the dialog.

## Major changes

1. **One dialog pattern.** `CreationDialog` supplies the existing Radix/shadcn dialog primitives, a visible heading/description, consistent padding/width, an accessible Close control and the agreed pending-dismissal guard. Module adapters retain scope, callbacks and permission gating. Team/project/task creation now looks and behaves consistently, including the top-bar creation entry points.
2. **One form/action pattern.** `CreationForm` owns the asynchronous submit lifecycle, immediate duplicate-submit guard, disabled fieldset, loading announcement/spinner, inline request error and Cancel/Create footer. It awaits the existing React Hook Form submit handler and mutation/cache lifecycle. The body scrolls independently of the header/footer; task-specific fields stack on small screens. Dialog dimensions do not animate during viewport resizing, avoiding temporary clipping.
3. **Connected labels and feedback.** `FormFieldWrapper` generates unique IDs with React `useId`, connects shadcn labels to controls, and supplies `aria-invalid`/`aria-describedby` links to hints, character counters and error alerts. Name/description, member selectors, priority and date triggers all receive these connections. Task date validation errors are now displayed rather than silently keeping submission disabled.
4. **Consistent failures and retries.** Team creation gains an inline server-error message. Project/team keep the existing `requestError` mapper; tasks keep `taskMutationError`. All three retain every draft value after failure and permit a deliberate retry. They reset and close on confirmed success. Idle Cancel/Close/Escape/backdrop dismissal still discards the form, and reopening starts fresh.
5. **Small shared-control fixes.** Textareas and selector/date triggers forward native identity/accessibility props. Priority stays controlled from its empty state, eliminating the uncontrolled-to-controlled warning without choosing a default. Date triggers explicitly use `type="button"` so opening a calendar cannot submit the form. Hint/counter text and user-selector avatar initials have stronger contrast. A whole date picker can be disabled separately from its existing per-day availability predicate.

## Structure and customization

All paths below are under `frontend/src`.

| File                                                                                      | Responsibility / where to customize                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common/components/CreationDialog.tsx`                                                    | Dialog heading/description, maximum height/width, header and Close styling, pending dismissal policy. The successful module callback closes directly; the guard applies to user dismissal.      |
| `common/components/CreationForm.tsx`                                                      | Submit guard/lifecycle, field disabling, scrolling body, error/status presentation and shared action footer. Domain fields and API hooks remain outside this component.                         |
| `common/components/FormFieldWrapper.tsx`                                                  | Field label, optional/required hint, frame, counters and accessible validation feedback. A render callback passes generated IDs/ARIA props to the actual control.                               |
| `features/{teams,projects,tasks}/components/Create{Team,Project,Task}Form.tsx`            | Existing module schema, defaults, fields, mutation hook and success callback. These forms reuse shared chrome instead of duplicating actions. Task assignment/support/date behavior stays here. |
| `features/{teams,projects,tasks}/components/Create{Team,Project,Task}Modal.tsx`           | Thin adapters for scope and success/cancel callbacks. Project/task dialogs key their lifecycle by workspace scope, so drafts and pending UI do not carry into another workspace.                |
| `common/components/{AutoResizeTextareaBase,DatePicker,PrioritySelector,UserSelector}.tsx` | Existing controls with optional identity/ARIA forwarding; date/priority disable support; priority empty-state and avatar-contrast fixes. Existing non-creation callers retain their defaults.   |
| `features/teams/components/TeamMemberSelector.tsx`                                        | Forwards the field identity/ARIA props through the existing searched/paged member selector.                                                                                                     |

Touched creation modules use the project's existing `@/` aliases for cross-module/UI imports. No new UI library or application dependency was needed. The existing React Hook Form, Zod, TanStack Query, Axios, Lucide and shadcn/Radix components remain the implementation stack.

## Rules preserved

- Task/project domain fields remain `name`. API payloads, URLs, server policies and cache keys are unchanged.
- Team/project names retain their existing frontend minimum of 3 characters and input maximum of 100. Task names retain 1–100 characters after trimming. These schemas are not silently unified in a UI-only phase.
- Description remains optional with the existing 2,000-character input limit. No new required task fields or defaults are introduced.
- Task priority and assignee remain required; support remains optional and cannot equal the assignee. Current team member searches/pagination and mutual exclusions remain in place.
- Both task planned dates remain required. Due dates before the start stay unavailable; moving start beyond an existing due date still adjusts due to start. Date/time serialization is unchanged.
- Creation permissions stay in existing callers/backend authorization. Shared presentation does not grant access. Existing confirmed cache refresh and session guards remain in the same mutation hooks.

## Verification

- **339 frontend tests in 38 files pass**: the existing 314 tests plus 25 creation-flow regressions. Tests exercise all three adapters through the real schemas/mutations, with focused selector/calendar test doubles, and cover label/hint/counter/error connections, duplicate submissions, pending fields and dismissal guards, draft retention/retry, exact existing payloads, confirmed close/success callbacks, idle dismissal/reset, closed forms, workspace changes, date feedback and automatic date adjustment.
- TypeScript, ESLint with zero warnings, repository Prettier check, production build and frontend Docker build pass (`team-task-manager-frontend:phase2j2`). The existing large-JavaScript-chunk build warning remains.
- The optional native Edge probe exercises the real app and real controls against mocked APIs: three failed creates with retained drafts, three successful retries with identical payloads, pending Escape/backdrop/Close/Cancel guards, idle backdrop dismissal, clean reopen, Critical priority, assignee/support exclusion, calendar selection and nested-popover Escape behavior. No uncaught page errors or unexpected browser console warnings remain.
- Desktop (1440×1000), mobile (390×844) and dark screenshots were inspected. On mobile, the task body scrolls to Planned Due without moving the header or overlapping the visible action footer.
- Nine scoped axe scans report **zero detected violations** across the three dialogs in light, dark and mobile error states, using WCAG 2 A/AA and 2.1 AA rule tags. This is automated coverage of these states, not full accessibility certification.
- `git diff --check` passes. HEAD stays `af7359b`; no files are staged, committed or pushed.

Browser probe: start Vite on `127.0.0.1:4187` with `VITE_API_URL=http://127.0.0.1:4187`; install `playwright` and `@axe-core/playwright` together in a temporary directory outside the repository, then run `node scripts/check-creation-flows.mjs <temporary directory>`. Optional environment variables: `TTM_TEST_BROWSER` (default Windows Edge path), `TTM_TEST_SCREENSHOTS` (existing output directory). Test tools are not added to the application manifest or lockfile. The probe waits for finite animations before contrast scans to avoid measuring intermediate theme/viewport transitions.

No backend/schema/dependency/development-data change was needed. Backend tests were not rerun for this frontend checkpoint; the previous 312 passing backend application tests remain historical evidence. Mocked browser APIs do not replace full backend-to-browser end-to-end checks.

## Remaining work

The separate mobile workspace sidebar issue recorded in Phase 2J part 1 remains for the broader responsive/usability review. Edit, membership, destructive-action and account dialogs are outside this focused three-create-flow checkpoint; they should be reviewed module by module rather than mechanically converted to this pending policy.

Next proposed checkpoint: Phase 2J part 3, broader responsive/accessibility checks and module usability review, starting with an audit and approval of any new behavior choices. Phase 2K remains release readiness. Approximately **four unfinished parts** remain across **two phases (2J–2K)**: 2J part 3 and 2K parts 1–3. Completing this UI batch is not a claim of production readiness.

Suggested user commit: `refactor: standardize team project and task creation forms`.

# Phase 2J part 3 — member batch dialogs

Baseline: user commit `65da55b`. The user approved bounded sizing, blocked editing/dismissal during requests and preservation of the existing partial-result/retry rules. This checkpoint is verified and awaiting user review/commit. Phase 2J part 3 remains in progress; four roadmap parts remain (2J3 and 2K1–3).

## What changed

### Shared layout and pending behavior

Add and remove batch dialogs now share `MemberBatchDialog`: a bounded `100dvh - 2rem` container, fixed header, disabled Close while pending, and guarded Escape/backdrop dismissal. Each form supplies its own scrolling body and fixed footer, keeping actions reachable on short screens. The add role list scrolls with the body instead of occupying a separate fixed-height scroll area.

While a batch runs, selection/search, selected-user removal controls, per-user roles, lookup retries, Cancel and submit are locked. `useMemberBatchSubmission` adds a synchronous duplicate-submit guard, includes validation and existing mutation/cache refresh time, and fences local feedback to the submitting editor/account. Forms remain mounted if the parent changes its loading state during a request, preserving drafts/results and allowing the dialog to unlock when the request settles.

After a partial result or failure settles, controls and dismissal become available again. Feedback scrolls into view in the body; the user can inspect results, edit unsuccessful selections, retry or close. Confirmed complete success closes the dialog. Opening another team/account or closing/reopening starts a fresh editor; a late old response cannot close or overwrite that new editor. The add search also resets on reopening, rather than silently retaining the previous opening's search.

### Batch and permission rules preserved

- Successful member changes remain saved independently. Partial success keeps the dialog open, removes confirmed successes from the selection and retains unsuccessful names and assigned roles for retry.
- A retry submits only the remaining selection, preserving an unsuccessful add's selected Admin/Member role. All-failed responses remain open and show their existing reasons.
- Transport failures retain selections and the existing uncertain-outcome guidance. Responses missing some outcomes retain unconfirmed selections and tell the user to refresh before retrying. No automatic mutation retry or new atomic batch behavior was introduced.
- Existing owner/admin addition/removal restrictions, owner exclusion, API payloads, response contracts and cache invalidation remain unchanged. Single-member removal and member-role actions are outside this checkpoint.
- Candidate endpoints and search limits remain unchanged. Dialog-owned candidate lookups now mount only while the dialog is open; query/cache policy remains in the existing hooks.

### Selector and presentation details

The member selector accepts accessible naming/description props and opens with Enter or Space without submitting its parent form. Its search input is named, and the popup/list shrink to the available screen height. Selected-user removal controls remain separate named buttons and stay disabled during a batch.

Per-user role controls have distinct names. The label **Roles per member** replaces the implementation-oriented heading. User-selection validation is associated with its control, forms expose busy state, and dialog descriptions use the existing accessible primitive. Local avatar initials, Member badges and the remove action have readable contrast; shared global color tokens and unrelated avatar instances were not changed. Touched add-form imports use the existing alias convention.

## Files and customization

| File                                                                 | Responsibility                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `frontend/src/features/teams/components/MemberBatchDialog.tsx`       | Shared dialog width/height, header, Close and dismissal policy                                   |
| `frontend/src/features/teams/hooks/useMemberBatchSubmission.ts`      | Duplicate guard, pending lifecycle and editor/account response fence                             |
| `frontend/src/features/teams/components/AddMembersModal.tsx`         | Opening/team/account lifecycle, candidate query and search                                       |
| `frontend/src/features/teams/components/AddMemberForm.tsx`           | Add selections/roles, scrolling body/footer, partial results and retry                           |
| `frontend/src/features/teams/components/RemoveMultiMemberModal.tsx`  | Removal eligibility, selections, scrolling body/footer, partial results and retry                |
| `frontend/src/common/components/MultiUserSelector.tsx`               | Named keyboard picker, retained badges and bounded popup/list                                    |
| `frontend/src/features/teams/components/MemberBatchDialogs.test.tsx` | Existing batch rules plus pending, duplicate, stale response, loading and permission regressions |
| `frontend/src/common/components/MultiUserSelector.test.tsx`          | Retained selections, disabled controls and named keyboard opening                                |
| `frontend/scripts/check-member-batch-dialogs.mjs`                    | Repeatable real-app mocked-API Edge check                                                        |

Adjust dialog bounds in `MemberBatchDialog`, body/footer spacing in each form, and popup bounds in `MultiUserSelector`. Keep scrolling on an ordinary body container and retain the non-shrinking footer. Different batch, permission or dismissal policies should be agreed explicitly rather than changed through a layout helper.

## Verification

- **430 frontend tests in 44 files passed**, including 31 focused batch/selector cases and 17 additional tests overall. Tests preserve partial/all-failed/transport/incomplete-result behavior, retained names and roles, successful-only removal from selections, exact retry payloads, lookup retry locks, duplicate submits, post-result dismissal, team/account/reopening isolation, parent loading transitions and owner/admin eligibility.
- TypeScript, strict ESLint, full Prettier verification, production compilation, frontend Docker build and Git whitespace checks passed. Backend tests were not rerun for this frontend-only checkpoint.
- The real app ran in headless Edge with mocked HTTP responses at short **390×500** and desktop **1440×1000** viewports. It verified long selections/body scrolling, reachable headers/actions, keyboard picker opening/search/bounds, focus containment, disabled controls, blocked Escape/backdrop, visible partial results and explicit retries of only the unsuccessful member, including the add's retained Admin role. The add and remove sequences each used one partial-result request followed by one fully successful retry. No development data was changed.
- **Seven scoped axe scans passed with no exclusions**, covering the short picker and selected/partial-result states plus dark desktop variants. Screenshots were visually inspected; no uncaught browser errors occurred. These checks do not claim every device, screen-reader workflow or a real-backend end-to-end run.
- The existing large-bundle warning remains. No dependency, schema, backend or API contract changes were made.

Artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/phase2j3e`.

## Remaining work

Other audit work still needs separately approved checkpoints: account/settings feedback, authorized profile entry links, broader accessibility/contrast, operational context DTO alignment and the root error fallback. Other member actions retain their existing behavior for separate review. Phase 2K still covers migrations, deployment/recovery and real end-to-end/security/load validation. This checkpoint does not establish whole-application production readiness.

No staging, commit or push was performed. Suggested user commit: `fix: harden member batch dialog flows`.

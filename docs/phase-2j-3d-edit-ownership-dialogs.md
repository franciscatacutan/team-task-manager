# Phase 2J part 3 — edit-user and ownership dialogs

Baseline: user commit `f495e3b`. The user approved bounded dialog sizing and locking fields/dismissal during saves, retaining failed drafts for retry. The user committed this verified checkpoint as `65da55b`. Phase 2J part 3 remains in progress; the remaining roadmap estimate is still four parts (2J3 and 2K1–3).

## Behavior changes

Both dialogs use the existing Radix/shadcn primitives with a maximum height of `100dvh - 2rem`. Headers and actions stay fixed inside that limit; the ordinary form body scrolls. This avoids scrolling a fieldset, preserves desktop sizing and keeps actions reachable at 390×500. Server errors scroll into view inside the body after a failed save, so an off-screen notice cannot silently hide the reason for failure.

While a save is running, inputs, selectors, Cancel, Close and the submit action are disabled. Escape and backdrop dismissal are blocked. A synchronous submission guard covers rapid repeat clicks and validation time, and the lock remains until the mutation and its existing cache refreshes settle. After failure, the same dialog is editable and dismissible again; retry sends the retained draft. Confirmed success closes it through the owning module callback. No automatic mutation retries were added.

### Edit user

- The existing atomic admin save and profile-only self-save retain their endpoints, payloads, validation and permissions. Email/password self-service stays separate; global-role editing remains restricted to its existing authorized viewers.
- Names, email and selected global role survive a rejected save. Current-page background refetches do not erase an open draft. Closing/reopening or changing the target/account starts a fresh editor.
- Late responses from an old target, opening or login cannot close the newly opened editor or display an old error there. Validation that finishes after the original editor/account is no longer current cannot begin its save.
- Existing field validation messages are now associated with their inputs through `aria-invalid` / `aria-describedby`. The form exposes its busy state.

### Transfer or recover ownership

- The same current-member eligibility and exact `TRANSFER` confirmation remain. Normal transfer and SUPER_ADMIN recovery keep their existing permission and ownership/admin-role rules.
- The selected successor and confirmation remain after rejection; retry targets that same member unless the user changes the draft. Reopening, switching teams/successors or switching accounts resets confirmation and isolates late responses.
- The successor selector now has an associated visible label. Team-member load retries are disabled during a transfer; their existing endpoint/search/page policy remains unchanged.
- The existing warning retains its tinted background and border, with readable foreground text. Proper dialog description semantics replace the unassociated paragraph.
- A network failure uses the existing uncertain-outcome guidance to refresh before retrying. This checkpoint adds no server idempotency guarantee and does not automatically repeat an uncertain transfer.

The root `DialogContent` now accepts an optional `closeDisabled` flag. It defaults to false, keeping other dialogs' behavior unchanged. These two dialogs use it to make the visible Close control match their pending policy; their local event guards enforce dismissal rules.

## Files and customization

| File                                                                     | Controls                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `frontend/src/features/users/components/EditUserDialog.tsx`              | User form lifecycle, pending guard, bounded layout, validation associations and visible save errors             |
| `frontend/src/features/teams/components/TransferOwnershipModal.tsx`      | Ownership/recovery presentation, confirmation lifecycle, pending guard, error handling and bounded layout       |
| `frontend/src/components/ui/dialog.tsx`                                  | Optional disabled Close control; existing default preserved                                                     |
| `frontend/src/features/users/components/EditUserDialog.test.tsx`         | Atomic/self-save, permissions, draft retention, pending and late-response regressions                           |
| `frontend/src/features/teams/components/TransferOwnershipModal.test.tsx` | Real mutation/query integration for eligibility, confirmation, transfer/recovery, retry and lifecycle isolation |
| `frontend/scripts/check-edit-ownership-dialogs.mjs`                      | Repeatable mocked-API native Edge viewport/accessibility check                                                  |

Change the dialog height/width and header/body/footer spacing in the two module components. Keep scrolling on the form body and keep the header/footer from shrinking. Any different pending/dismissal or ownership policy should be agreed separately rather than changed through the shared dialog default.

## Verification

- **413 frontend tests in 44 files passed**, including 25 focused edit/ownership cases (11 additional tests overall). The ownership suite now exercises real query/mutation hooks and API-client mocks instead of mocking mutation behavior.
- TypeScript, strict ESLint, full Prettier verification, production compilation, frontend Docker build and Git whitespace checks passed. Existing creation/reset flows are covered by the full suite following the shared Close-control addition.
- The real app ran in headless Edge with mocked HTTP responses. Checks cover short 390×500 and desktop 1440×1000 layouts, fixed reachable actions, actual body overflow, focus containment, disabled fields/Close/Cancel, blocked Escape/backdrop, visible failed-save notices, retained atomic user payloads, normal ownership and recovery, and explicit successful retries. Six write requests represent three rejected attempts followed by three successful retries; no development data was touched.
- **10 scoped axe scans passed with no exclusions** for validation, ready and failed states, including dark desktop variants. Screenshots were visually inspected. The user-directory edit dialog is opened at desktop size before shrinking to simulate a short viewport; this probe does not establish usability of every directory-table layout.
- Existing large-bundle warnings remain. Backend tests were not rerun for this frontend-only checkpoint. Mocked browser checks do not replace real-backend end-to-end, screen-reader or device testing.

Artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/phase2j3d`.

## Scope and remaining work

No backend, API contract, schema, dependency or permission-policy changes were made. Member add/remove batching and its partial-result/retry semantics remain a separate checkpoint; no generic pending rule was applied to those flows. Other audit work includes account/settings feedback, profile navigation, broader accessibility/contrast, operational context DTO alignment and the root error fallback. Phase 2K retains release migrations, deployment/recovery and security/end-to-end/load validation.

No staging, commit or push was performed. Suggested user commit: `fix: harden user edit and ownership dialogs`.

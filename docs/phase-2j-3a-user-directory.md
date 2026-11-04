# Phase 2J part 3 — password-reset and directory checkpoint

Baseline: user commit `5fb35c5`. The review-first UI/usability audit found cross-target reset drafts, unhandled reset failures and false-empty directory searches. The user approved this focused fix batch. It is implemented and verified, awaiting user review/commit. This is the first fix checkpoint within 2J3; it does not complete the entire UI audit.

## Confirmed choices

- During an admin password reset, disable fields, Cancel, Close, Escape and backdrop dismissal until the request settles.
- After a failed reset, retain the two fields only for the same target in the same open dialog, with a visible request error and explicit retry.
- Clear sensitive drafts/errors on dismissal, reopening or target changes.
- Keep directory statistics frontend-only and explicitly label them as counts on the displayed page; no directory-wide aggregate endpoint is added.

## Changes and why

### Password reset

Previously, the form remained mounted across closing and changing users, reset only on success and did not catch rejected requests. A failed draft could therefore appear in another person's dialog. Escape could close a pending operation even though Cancel was disabled.

`ResetUserPasswordDialog` now mounts an editor only while open with a target, keyed by that user's ID. Its form state and mutation error presentation belong to that editor. A same-user background profile refresh preserves an open draft; closing/reopening or changing the ID creates a fresh editor.

Submission uses an immediate duplicate guard and a pending lifecycle covering validation and the request. The editor catches failures, displays an inline alert and permits deliberate retry. A network failure explicitly says the result could not be confirmed and may have succeeded; writes are not automatically retried. A successful response closes only the current editor: unmount and authentication-revision guards prevent an old request from closing or changing a different target, a reopened dialog or another login.

All user dismissal paths and fields are disabled while pending. The dialog has a bounded height, an independently scrolling body and a reachable action footer. Labels/hints/validation reuse `FormFieldWrapper` and generated IDs/ARIA connections. A loading announcement and spinner expose progress. The reset action uses a local solid-red treatment because the previous tinted destructive button failed contrast checks.

Existing 8–100-character validation, password matching and `PATCH /admin/users/{id}/password` with `{ newPassword }` remain. Server authorization, reset/session-revocation behavior and action visibility rules are unchanged. These changes do not add temporary-password expiry, forced password change or a password-delivery feature.

### Directory

Changing search now resets the directory to page 0 before the debounced query settles. Searching from a later page can no longer request a nonexistent page of otherwise matching results.

Confirmed result sets can also shrink after account changes/refetches. If the current page is beyond the new last page, the page recovers to the last valid one. Recovery ignores errors and `keepPreviousData` placeholders, because those do not describe confirmed pagination for the current request. A genuine empty result remains at page 0 without a fetch loop.

The statistic cards now say **Users on this page**, **Global admins on this page** and **Super admins on this page**. They retain their existing calculation; pagination still supplies the total number of matching users. The directory search is labeled **Search users**, including its accessible name and placeholder. The shared toolbar/search control accepts an optional label; other callers retain their existing default until their separate usability cleanup.

## Files and customization

All paths below are under `frontend/`.

| File                                                             | Controls                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/users/components/ResetUserPasswordDialog.tsx`      | Target/opening lifecycle, password schema, pending/dismissal guards, request errors, late-response/session guards, reset layout and button styles.      |
| `src/pages/UsersPage.tsx`                                        | Search page reset, confirmed shrinking-page recovery and directory search label. Existing filters/sort/permissions remain here.                         |
| `src/features/users/components/UsersHeader.tsx`                  | Current-page statistic copy and existing role counts. Directory-wide aggregates remain outside this component.                                          |
| `src/common/components/toolbar/{ToolBar,SearchBar}.tsx`          | Optional `search.label`, accessible search naming and placeholder. The default remains `Search teams` for unmodified callers.                           |
| `src/features/users/components/ResetUserPasswordDialog.test.tsx` | Reset request/payload, duplicate/pending protection, retry retention, clearing/retargeting, stale completion/session guards and validation regressions. |
| `src/pages/UsersPage.test.tsx`                                   | Later-page search, label scope, shrinking-page recovery and genuine-empty-result regressions.                                                           |
| `scripts/check-user-directory.mjs`                               | Optional real-app Edge probe using mocked APIs and scoped axe scans.                                                                                    |

## Verification

- **358 frontend tests in 40 files pass**: 339 baseline tests plus 19 new regressions in two files. The reset tests use the real schema/mutation path and verify the exact endpoint/body, old-target completions, old-opening completions, login changes and caught failures. Directory tests exercise the real query/pagination flow against generated server-page responses.
- TypeScript, ESLint with zero warnings, repository Prettier check, production compilation and frontend Docker build pass (`team-task-manager-frontend:phase2j3a`). `git diff --check` passes.
- Native Edge probe: search from page 2 returns matching Ada users via page 0; all current-page labels render; pending fields/dismissal are blocked; failed target A can close and target B opens empty; B retains its own failed draft and retries with the same payload; confirmed success closes. The fixture observed two rejected reset requests and one successful retry, with no uncaught page errors.
- Three scoped axe scans report zero detected violations: desktop error, short mobile error and dark clean reopen. Screenshots were inspected at 1440×1000 and 390×500. These are focused dialog scans, not a claim that unrelated directory controls or the whole application pass accessibility checks.
- Optional browser rerun: start Vite on `127.0.0.1:4187` with `VITE_API_URL=http://127.0.0.1:4187`; install `playwright` and `@axe-core/playwright` together in a temporary directory outside the repository; run `node scripts/check-user-directory.mjs <temporary directory>`. Optional `TTM_TEST_BROWSER` overrides the Windows Edge default; `TTM_TEST_SCREENSHOTS` names an existing output directory. Neither tool is an application dependency.

No backend, schema, application dependency or development-data change was needed. No actual password was reset by these probes. Backend tests were not rerun for this frontend checkpoint. The existing large-JavaScript-chunk production-build warning remains. HEAD stays `5fb35c5`; nothing is staged, committed or pushed.

## Remaining audit work

This addresses the reset lifecycle/error finding and the directory pagination/count-label portion of the review, plus reset-specific sizing/feedback. Other audited findings remain: mobile workspace navigation, keyboard links/sort/board opening, icon names/contrast, member/ownership dialog policies, comment/log failure feedback, operational DTO context, profile links and root crash recovery. Other search contexts still need their own accurate labels. No account-wide or team permission policy was broadened.

Recommended next checkpoint: agree on the shared mobile-navigation pattern, then implement keyboard-accessible navigation/sorting and names in a focused batch. Scope/design choices still need approval. **Phase 2J3 remains in progress; approximately four roadmap parts remain** (2J3 plus 2K1–3).

Suggested user commit: `fix: isolate password resets and correct directory paging`.

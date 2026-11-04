# Checkpoint 1 — profile navigation

Verified November 5, 2026 against user commit `ec1fabc`. The user approved the finite [v1 checklist](v1-completion-checklist.md), profile navigation first, and conservative links in archived/unconfirmed contexts. This checkpoint is verified and awaiting user review/commit. Seven checkpoints remain; later implementation still needs separate approval.

## Behavior and purpose

- Directory first names and eligible member full names are native profile links, with a full-name accessible label, keyboard focus and normal new-tab behavior. Row administration menus remain independent; the misleading directory row pointer cursor is removed.
- Self and global ADMIN/SUPER_ADMIN names link in authorized views. Ordinary peer names link only when both member-list and viewer-membership reads succeed, the team is active and the membership identity matches the signed-in viewer with OWNER/ADMIN/MEMBER role. Pending, failed, mismatched or failed-refresh evidence does not enable peer links. Archived ordinary peers stay plain text, even if another active team might independently permit their profile.
- Profile reads still pass through the existing server policy. Limited peers show names/email and shared teams without global account roles or edit access. Viewing a privileged profile does not grant editing rights. On denial, existing cached identity/edit content remains hidden. The unavailable state adds an Open workspace exit and a disabled, named retry-in-progress state.

## Files and customization

| File                                                                | Responsibility / customization                                                                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/features/users/components/UserProfileLink.tsx`        | Shared native link/plain-name rendering, route, accessible label, focus/hover appearance; change its classes to adjust link styling |
| `frontend/src/features/users/utils/profileNavigation.ts`            | Pure self/global/confirmed-team affordance decision; this is not a security boundary                                                |
| `frontend/src/features/teams/components/MembersView.tsx`            | Supplies confirmed active-team evidence from existing auth/member queries                                                           |
| `frontend/src/features/teams/components/MembersList.tsx`            | Renders full member names using the supplied predicate                                                                              |
| `frontend/src/features/users/components/UsersList.tsx`              | Renders first-name entry links while preserving separate name columns and admin menus                                               |
| `frontend/src/pages/ProfilePage.tsx`                                | Unavailable destination feedback, retry pending state and workspace exit                                                            |
| `frontend/src/features/users/components/ProfileNavigation.test.tsx` | Integration regressions with real hooks/router/query cache and mocked HTTP responses                                                |
| `frontend/scripts/check-profile-navigation.mjs`                     | Repeatable Edge/Playwright probe with synthetic API fixtures and scoped axe scans                                                   |

The two existing directory/member tests now provide the router/auth context required by real links. README, roadmap and checklist record the approved finite plan and current status. Existing backend `UserVisibilityPolicy` remains authoritative. Expanding link eligibility or access policy is a separate decision.

## Verification and limits

- **489 frontend tests in 49 files pass**, including 19 new navigation/access cases: three active team roles, self/global visibility, archived peers, pending/failed/mismatched membership, failed cached refreshes, directory actions, limited role disclosure and denied cached-profile retry recovery.
- TypeScript, strict ESLint (`--max-warnings 0`), Prettier check, production frontend build, frontend Docker build and Git whitespace checks pass. The existing large-bundle warning remains; bundle splitting is not part of this checkpoint.
- Headless Edge runs the real Vite app with mocked HTTP APIs at desktop/mobile sizes. Native Enter and Control-click new-tab navigation pass; edit/reset menus remain separate. Pending proof hides peers' links until resolved. Archived ordinary/global views, limited profile and cached-denial/retry/workspace recovery pass. No application mutation requests or uncaught browser errors occur.
- Six scoped axe scans pass with no exclusions: directory name links, unavailable-profile feedback, active-member name links, limited teammate header, archived ordinary self link and dark archived global-admin links. Screenshots were visually inspected. These scans do not claim full-page accessibility: existing table/role controls/contrast are explicitly tracked in checklist checkpoints 3–5.
- Backend/API/schema/dependencies/session policies and real development data are unchanged. Backend tests were not rerun. Browser fixtures verify UI behavior, not a real-backend end-to-end/security/release assessment; those remain later approved work.

Browser setup uses a temporary external installation of `playwright` and `@axe-core/playwright`, not new application dependencies. Start Vite with `VITE_API_URL=http://127.0.0.1:4187` on port 4187; pass that installation directory to `node scripts/check-profile-navigation.mjs <directory>`. `TTM_TEST_BROWSER` can select a browser executable; `TTM_TEST_SCREENSHOTS` selects an existing output directory. The probe mocks all API requests. Stop Vite after verification.

Artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/checkpoint-1-profile-navigation`.

No staging, commit or push was performed. Suggested user commit: `feat: add profile links with existing access rules`.

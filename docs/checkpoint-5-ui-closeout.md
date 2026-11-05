# Checkpoint 5 — UI close-out

Verified November 5, 2026 against user commit `a88f461`. The user approved the final UI review, then explicitly approved correcting both recorded observations, the additional pagination/control-name gaps and the type-only KPI response mismatch within this checkpoint. No checkpoint was added.

**Result: Phase 2J is verified complete in the agreed UI-hardening scope; the user committed this checkpoint as `187d103`. This record retains its checkpoint-5 verification baseline; see the [current checklist](v1-completion-checklist.md) for later progress. No known in-scope UI blocker or accepted UI deferral remains. Three release-readiness checkpoints remain (6–8).** This is not production release sign-off or deployment authorization.

## Approved corrections

| Change                        | Before → verified behavior                                                                                                                                                             | Files / customization                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured operational labels | Message inference could call updates Comment → known event types/names use one exhaustive label map, preserving Archived; unknown names are humanized; summaries retain their behavior | `common/utils/activityFormatter.tsx` owns the label map/lookup; `common/components/ObservabilityLogs.tsx` selects structured fields and unknown-name fallback  |
| Narrow project tabs           | At 320px tabs could shift content/card heading sideways → compact two-column narrow layout, existing desktop row, native arrow-key selection and zero horizontal workspace shift       | `features/projects/components/ProjectDetails.tsx` tab-list classes and width constraints; adjust the small-screen grid here                                    |
| Member page size              | Selecting 20 still requested/displayed 10 → selected size is sent to the existing query; page resets and 20 members render                                                             | `features/teams/components/MembersView.tsx` query parameters                                                                                                   |
| Control names                 | Shared page size/project status lacked accessible names → Rows per page / Project status names survive selected and disabled states                                                    | `common/components/pagination/PageSizeSelector.tsx`, `features/projects/components/ProjectStatusSelector.tsx`                                                  |
| KPI interfaces                | Team/project summary types declared unused key fields absent from the API → `teamId`/`projectId` match existing UUID DTO fields; routes still use public keys                          | `features/teams/types/teamInsights.types.ts`, `features/projects/types/projectInsights.types.ts`; actual summary API/permissions/metrics behavior is unchanged |

Paths in that table are under `frontend/src`. No backend, schema, dependency, session/permission policy, real account or development-data change was made.

## Regression structure and probe maintenance

- **15 new frontend cases:** eight team/project operational-label cases, one real-hook member pagination flow, three control-name/legacy-label cases and three typed/populated/empty KPI contract cases. `QueryConsistency.test.tsx` also now uses the actual KPI UUID response fields. Static fixture checks prevent public-key aliases reappearing as response fields.
- `check-list-accessibility.mjs` keeps its original contrast-only default. Set `TTM_TEST_FULL_ACCESSIBILITY=1` to run the wider WCAG-tagged close-out scan. It also verifies that selecting 20 members produces a 20-row request and response display.
- `check-log-context.mjs` now uses populated DTO-shaped KPI summaries, tests summary failure/retry independently of logs, validates structured event labels and measures narrow tabs with native keyboard navigation.
- `check-comment-log-feedback.mjs` retires the resolved avatar exclusion; its 12 scoped scans now include those avatars. No probe contains an axe exclusion or disabled rule.
- Two historical probes needed maintenance, not application fixes: task opening follows the current named Open task button rather than the pre-2J3b heading; the session probe uses current auth labels, JWT-shaped fixtures and the unread-count object contract. Its coordination/rotation/account-switch assertions remain intact.

## Original 13 findings reconciled

All findings below are resolved in the agreed original cases. Historical audit documents retain their original baseline; current evidence is recorded here and in browser result artifacts.

| #   | Original concern                                          | Current evidence                                                                                                                   |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cross-user password-reset drafts and unhandled failures   | Directory/reset probe: target isolation, pending dismissal, retained same-target retry, short/dark states                          |
| 2   | Keyboard navigation, sorting and task open/drag conflicts | Workspace navigation probe: native links, keyboard sort, separate task opening and pointer/keyboard moves                          |
| 3   | Mobile workspace squeeze                                  | Drawer focus, Escape/backdrop/route closure, focus restoration, team switching and preserved desktop collapse                      |
| 4   | Directory paging/counts and contextual search             | Directory page-reset/count checks, required domain labels, and selected-size member request/render regression                      |
| 5   | Log read failures disguised as empty                      | Independent team/project audit/system errors and retries, confirmed empty states and denied-cache handling                         |
| 6   | Silent/misleading comments/auth/settings/member feedback  | Account, comment, member-role and batch probes cover loading, pending, validation, error, draft retention and retry                |
| 7   | Short dialogs and pending-dismissal policies              | Reset/edit/ownership/add-remove/single-member/creation probes verify bounds, locks and retained failed intent                      |
| 8   | Missing control names, switcher semantics and scrolling   | Named navigation/role/page-size/status/search controls; native table overflow/fitting checks; settings preference/tab checks       |
| 9   | Avatar and muted-on-tinted contrast                       | Wider light/dark scans, populated KPI pages and focused error/disabled states; old avatar exclusion removed                        |
| 10  | Unsupported regular-member team creation                  | Existing role tests and switcher/navigation probe retain the authorized creation/recovery matrix                                   |
| 11  | Operational response contract mismatch                    | Existing UUID log fields and corrected summary identity types; typed fixtures and real rendered KPI/log views                      |
| 12  | Root fallback depends on unavailable router               | Forced render/provider faults retain provider-independent recovery, current-route reload and workspace exit                        |
| 13  | Profiles lack authorized entry links                      | Native directory/member links; self/global/current-active-teammate affordance, archived plain peers, denied cached identity hidden |

## Current module/flow evidence

| Module or flow                           | Browser probe(s)                                                                                          | Scope                                                                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication/settings                  | `check-account-feedback`, `check-session-tabs`                                                            | Login/register failures and validation, form locks/drafts, settings tabs, credential sign-out; three isolated coordinator tabs plus two full-app tabs, single concurrent refresh, stale reads/account switching/storage/logout |
| Shell/team selection/navigation/overview | `check-workspace-navigation`, `check-list-accessibility`                                                  | Mobile/short drawer, collapsed desktop, switching, links/sorts; populated overview and team list reachability                                                                                                                  |
| Users/profiles                           | `check-user-directory`, `check-profile-navigation`, `check-edit-ownership-dialogs`                        | Search paging/counts, reset isolation, atomic edit feedback, short dialogs, native profile links, limited/archived/denied states                                                                                               |
| Members/ownership                        | `check-member-batch-dialogs`, `check-single-member-actions`, `check-edit-ownership-dialogs`               | Partial batches and exact retries; role save/error/confirmed state; owner/recovery dialogs and pending locks; selected page size covered in unit and wider browser matrix                                                      |
| Projects                                 | `check-list-accessibility`, `check-log-context`, `check-workspace-navigation`                             | Board/list entries, search/status names, native narrow tab selection, bounds, project task opening and read-only rules tested in existing unit/backend suites                                                                  |
| Tasks page/dialog/board/list             | `check-task-view`, `check-comment-log-feedback`, `check-workspace-navigation`, `check-list-accessibility` | Confirmed saves/comments, draft reset, read-only/denied retry, separate drag/open, list keyboard/short layouts                                                                                                                 |
| Activity/notifications                   | `check-activity-navigation`, `check-notification-inbox`, `check-list-accessibility`                       | Full-history search, bounded page grouping, focus, older unread pages, read/write failures and retries, fresh/unavailable destinations and mobile inbox                                                                        |
| KPI summaries and operational logs       | `check-log-context`, `check-comment-log-feedback`                                                         | Backend-shaped populated summaries, independent summary retries, structured labels, UUID/null context, paging/sort and per-stream failures                                                                                     |
| Creation and root recovery               | `check-creation-flows`, `check-crash-recovery`                                                            | Confirmed creates/failed drafts, date/member controls and dismissal locks; deliberately forced caught faults across sizes/themes                                                                                               |

Source permission/read-only/session guards and current frontend/backend suites complement these synthetic browser cases. This table does not claim every Cartesian combination of role, browser, archive, request failure and layout.

## Final verification

- **Frontend: 542 passed tests in 54 files**, including the 15 additions. TypeScript, strict ESLint (`--max-warnings 0`), full Prettier and Git whitespace checks pass; local documentation links resolve.
- **Backend: Maven verify succeeds; 330 reported tests, 329 passed and one intentional opt-in profiling skip.** Integration fixtures use PostgreSQL 17 Testcontainers with test-only configuration/create-drop; the development database is not used. Local Maven runs JDK 25 with Java 21 compilation target, matching the established local workflow.
- Production frontend build and both Docker images pass. Docker builders use Java 21 and Node 24. These are local checks, not a claim about a remotely executed GitHub Actions run.
- **All 16 browser probes pass.** Their **126 automated scans** cover 38 wider selected page states and 88 scoped component/dialog states, with no violations or exclusions. The wider scan uses WCAG 2 A/AA and 2.1 AA tags. Native browser geometry verifies the narrow project tabs remain at x=16–304 with zero horizontal workspace scroll, and member page-size 20 requests/renders 20. Representative final screenshots were visually inspected.
- Browser probes run the actual Vite app in Edge with mocked APIs and synthetic intercepted writes. Reported uncaught browser errors are zero; root-recovery probes deliberately exercise caught faults. This is not a real-backend browser end-to-end run, screen-reader conformance assessment or every browser/device. The old avatar exclusion has been removed rather than carried as a deferral.
- The existing large-bundle warning is retained for release acceptance. Deployment configuration/HTTPS/secrets, migration upgrade paths, backup/recovery, real-stack security/end-to-end/load targets and release sign-off are the remaining checkpoints, not implied by UI close-out.

## Remaining approved plan

1. **Checkpoint 6 / 2K1:** choose/version/test database migrations and the agreed baseline/upgrade path.
2. **Checkpoint 7 / 2K2:** choose the deployment target and verify operations, monitoring and recovery.
3. **Checkpoint 8 / 2K3:** agree targets and verify the real stack, security/load/end-to-end acceptance and release checklist.

Each needs separate implementation approval. No database reset, production deployment or new Jira capability is authorized by this close-out.

For browser reproduction, use a temporary external installation of `playwright` and `@axe-core/playwright`; start Vite at `127.0.0.1:4187` with `VITE_API_URL=http://127.0.0.1:4187`, and pass the tool-installation directory to each script. Set `TTM_TEST_FULL_ACCESSIBILITY=1` for the full list/page audit. Stop Vite and remove temporary tooling afterward. No browser packages were added to application dependencies.

Artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/checkpoint-5-ui-closeout`.

No staging, commit or push was performed. Suggested user commit: `fix: close UI audit gaps and align insights contracts`.

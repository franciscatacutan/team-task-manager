# Checkpoint 2 — operational-log context contracts

Verified November 5, 2026 against user commit `f1a53b0`. The user approved matching the existing API, clearly labeling internal IDs, omitting missing context and keeping this checkpoint frontend-only. The user committed it as `b414860`. See the approved [v1 completion checklist](v1-completion-checklist.md) for current progress and later implementation approvals.

## Behavior and purpose

The backend already returns UUID `teamId`, `projectId`, `taskId`. The frontend incorrectly expected `teamKey`, `projectKey`, `taskNumber`, so real context did not appear. Both audit and system-event models now use the nullable UUID fields. Public route keys and task numbers elsewhere remain unchanged.

Both streams share one context formatter. Present values display in full as Team ID, Project ID and Task ID, making the identifier kind explicit and retaining the exact value for diagnostics. Missing values produce no chip or placeholder. UUIDs remain plain text; no routes are invented from internal IDs. Metadata chips wrap long text within their available width instead of truncating UUIDs. Existing actors/system fallback, pagination, sorting, error/retry/cache behavior, query scopes and server permissions remain unchanged.

## Files and customization

| File                                                        | Responsibility / customization                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/common/types/observability.types.ts`          | Both response contracts now declare nullable `teamId`, `projectId`, `taskId`; keep these matched to backend DTOs                |
| `frontend/src/common/components/ObservabilityLogs.tsx`      | `scopeMetadata` controls labels/order/presence for both streams; `LogRow` chip classes control wrapping and spacing             |
| `frontend/src/common/components/ObservabilityLogs.test.tsx` | Backend-shaped typed fixtures and ten additional team/project cases; existing feedback cases retained                           |
| `frontend/scripts/check-log-context.mjs`                    | Repeatable native Edge probe with mocked HTTP APIs, narrow/desktop light/dark geometry and metadata-scoped accessibility checks |
| README, roadmap and checklist                               | Record checkpoint 1 user commit, checkpoint 2 status and explicit follow-up observations                                        |

No new frontend package, backend/API/schema/session/permission change or real development-data edit was made. Readable names/public keys or navigation enrichment remain a separate scope choice.

## Verification

- **499 frontend tests pass in 49 files**, including **24 log tests**. Six new context cases failed against the old renderer and pass after alignment. The ten additions cover full UUIDs, populated/null actors, all-null/team-only/task-without-project context, no invented links, independent pages and resetting both streams on sort changes. Existing errors, denied cached reads, exact-page retry and empty-state checks continue to pass.
- TypeScript, strict ESLint (`--max-warnings 0`), full Prettier check, Git whitespace check, production frontend build and frontend Docker build pass. The existing large-bundle warning remains.
- Native Edge runs the real Vite app with all APIs mocked, in team 390×844 light / 1440×1000 dark and project 320×568 dark / 1440×1000 light. Both streams display full IDs; next-page null context disappears; native keyboard sort resets both pages and restores context. No application mutations or uncaught browser errors occur.
- **Eight scoped axe scans pass without exclusions**, covering only changed UUID metadata in both streams across those four layouts. Geometry verifies the chip text wraps within its available width. Screenshots were visually inspected. This does not claim whole-page accessibility or a fixed project layout; the narrow project-container scrolling observation is explicitly recorded in the checklist, with unchanged geometry when UUID chips are hidden. The pre-existing event-label inference issue is also recorded for explicit triage, not silently deferred or fixed.
- Backend tests were not rerun. Browser APIs are synthetic; this is not real-backend end-to-end/load/security/release acceptance. Full cross-module UI close-out remains checkpoint 5.

For the browser probe, install `playwright` and `@axe-core/playwright` in a temporary external directory. Start Vite on `127.0.0.1:4187` with `VITE_API_URL=http://127.0.0.1:4187`; run `node scripts/check-log-context.mjs <installation-directory>`. Optional `TTM_TEST_BROWSER` selects an executable; `TTM_TEST_SCREENSHOTS` selects an existing output directory. No browser-test packages were added to application dependencies. Stop Vite and remove temporary tooling afterward.

Artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/checkpoint-2-log-contracts`.

No staging, commit or push was performed. Suggested user commit: `fix: align operational log context with UUID response fields`.

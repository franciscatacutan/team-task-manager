# Phase 2J part 3 — root crash recovery

Baseline: user commit `1573530`. Verified November 5, 2026. The user approved a provider-independent root fallback with Reload and Workspace actions and regression tests for forced rendering failures. The user committed this verified checkpoint as `ec1fabc`. Phase 2J part 3 remains in progress; the historical four-part estimate has been superseded by the approved [v1 completion checklist](v1-completion-checklist.md).

## Problem and resulting behavior

The root error boundary surrounds the query, authentication and router subtree. React removes that failed subtree when the boundary catches an error. Previously the boundary then rendered `ErrorPage`, whose `useNavigate` hook required the removed router. The fallback could therefore throw another error and leave the application blank.

`ErrorBoundary` now renders a dedicated `CrashRecovery` component with no router, authentication or query hooks. It reuses existing stateless UI primitives and global CSS tokens. The boundary keeps its existing console error reporting and remains in its existing outer position; the constructor boilerplate is replaced by a typed class state initializer.

The recovery screen provides:

- **Reload**: a native full-page reload of the current URL, rebuilding the application and its providers.
- **Open workspace**: a native `/teams` link that performs a full-page navigation, rebuilding the app at its workspace entry point. Normal startup authentication and route authorization still determine access.
- A focused heading, an alert message, named keyboard-accessible actions, decorative icons hidden from assistive technology and readable light/dark styling. Actions retain a 40px height on mobile and desktop; very short screens can scroll to them.

The fallback stays visible until explicit navigation. It does not reset the boundary repeatedly, automatically reload, replay application mutations, clear browser storage, sign users out or display private exception details. If a fault persists after Reload, recovery remains usable rather than failing itself. The underlying persistent defect still needs fixing; these actions do not promise that every fault disappears.

The router-owned `ErrorPage` and existing unknown-route behavior remain unchanged, matching the selected crash-recovery-only scope.

## Files and customization

| File                                               | Responsibility                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/common/ErrorBoundary.tsx`            | Catches React subtree failures, retains console reporting and selects the independent fallback                                         |
| `frontend/src/common/components/CrashRecovery.tsx` | Copy, focus/announcement, responsive styling and native recovery actions                                                               |
| `frontend/src/common/ErrorBoundary.test.tsx`       | Healthy/render/effect/provider/context-loss regressions, latched recovery, keyboard/storage behavior and existing route-error behavior |
| `frontend/scripts/check-crash-recovery.mjs`        | Real-app mocked browser probe with forced module render/provider failures                                                              |

Change recovery copy, spacing and action appearance in `CrashRecovery`. Keep its navigation native and its rendering independent of the providers it replaces. A missing-page redesign, different recovery destination, local boundary retry or external error reporting would be separately agreed work.

## Verification

- **470 frontend tests in 48 files passed**, including eight new cases. The regression reproduces failure outside router/query context, exercises a provider that fails before supplying children, checks React effect failures, confirms explicit recovery rather than automatic subtree resets, verifies initial heading focus and keyboard action order, and confirms storage is not cleared by showing recovery.
- TypeScript, strict ESLint, full Prettier verification, production compilation, frontend Docker build and Git whitespace checks passed. The existing frontend large-bundle warning remains.
- The real app ran in headless Edge. Only the Playwright network context replaces dev-module responses to inject faults; no debug crash flags, query parameters or crash controls were added to application source. APIs use synthetic fixtures and no development data is touched.
- The browser probe injects three caught failures: an application rendering failure, the same persistent failure after a manual reload, and an authentication-provider initialization failure. It verifies the current URL is retained on Reload, a transient fault can recover to Settings, Open workspace performs full-page navigation to `/teams`, keyboard actions work, storage survives, and the fallback causes no application mutation requests.
- **Five scoped axe scans passed with no exclusions** at 390×844 mobile, 320×320 short, 390×500 dark mobile and 1440×1000 light/dark desktop states. Rendered action heights and scroll reachability are checked. Screenshots were visually inspected; the three expected caught errors were logged with no uncaught browser errors.
- Backend tests were not rerun for this frontend-only change. Browser checks use the Vite dev server and mocked APIs, rather than the production bundle or a real-backend end-to-end run. A React boundary does not cover failures before React mounts, failed bundle loading or every asynchronous/event-handler error; this checkpoint adds no global interception or telemetry.

Artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/phase2j3g`.

No backend, schema, dependency, API, permission or session-policy change was made. Profile discoverability, operational context DTO alignment and broader accessibility/contrast remain separately scoped review work. Phase 2K retains release migrations, deployment/recovery and end-to-end/security/load verification.

No staging, commit or push was performed. Suggested user commit: `fix: make root crash recovery independent of app providers`.

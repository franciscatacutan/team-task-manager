# Phase 2E: immediate session revocation

Approved scope: immediate revocation after password changes/resets and logout, visible logout failure feedback, and regression tests. Multi-tab refresh coordination remains deferred. Baseline: `be77aae` (`fix: preserve workflow state and align archived access`).

## Resulting behavior

| Action                                               | Result                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Login or registration                                | Creates a refresh-token family and an access token bound to that family                                            |
| Normal refresh                                       | Rotates the refresh token while retaining its family; earlier unexpired access tokens from that login remain valid |
| Logout                                               | Revokes the current login's entire family; other independent logins remain usable                                  |
| Own password change or administrative password reset | Revokes all existing families for the affected user, including their access tokens                                 |
| Login email change                                   | The existing all-session revocation now invalidates access tokens as well as refresh tokens                        |
| Refresh-token replay                                 | Existing family-wide replay protection now invalidates that family's access tokens too                             |
| Session expiry                                       | An otherwise unexpired access token cannot authenticate if its refresh session has expired                         |

“Immediate” means the server rejects the next protected request after the revocation transaction commits. This does not cancel requests that already passed authentication or remotely erase data already displayed in another browser. That browser discovers revocation on its next request and follows the existing sign-in flow.

## How session validation works

This reuses the existing `refresh_tokens` table and stable `familyId`; no new session table or user-version field is introduced. Access JWTs gain a signed `sid` claim containing the family ID. Each JWT also has a unique `jti`; `userId`, role, email subject, issuer, issuance, expiry, and the existing response shape are retained.

For every protected request, `JwtAuthFilter` validates the token's signature, issuer, expiry and required subject/user/session claims, loads current user authorities, and checks that an unrevoked, unexpired refresh-token row exists for that exact family and user. Revocation checks are not cached. A valid signature alone cannot bypass revoked, expired, missing, or another user's session state.

Logout accepts the current bearer explicitly, so it also works when the refresh cookie is absent. If the bearer is usable, its family identifies the current login. If the bearer is missing, expired, or invalid, the refresh cookie identifies the family instead. A rotated ancestor cookie can still identify and revoke its current descendant. Logout remains idempotent and still requires the configured trusted Origin. The cookie is cleared only after server-side revocation completes successfully.

Login now acquires the same user-row lock as credential changes, refresh and revocation before checking credentials. Password/email changes lock the credential row before reading or mutating it. A reset cannot finish and then be followed by session issuance using a password checked before that reset. Unknown accounts still go through the authentication manager's credential handling.

## Frontend behavior

- Sign-out waits for the server response before clearing the in-memory token, private query cache, and navigating to sign-in.
- A failed sign-out shows an accessible retry/dismiss message and retains local credentials and cached state. A lost response might mean the server already revoked the session; retry is safe and idempotent. The UI does not claim that revocation succeeded when it cannot confirm it.
- Repeated sign-out clicks are suppressed, and the menu shows a pending state.
- Bootstrap and automatic 401 retries share one refresh request within a tab. This avoids accidentally replaying the same refresh cookie through independent callers.
- Session revisions fence late refresh responses after logout, local clearing, or a new login. Old failures cannot clear a newer login, and an old request cannot be retried under a new user's credentials.
- Raw Axios errors are no longer logged by the shared interceptor because their request configuration can contain bearer credentials. Errors still reach the calling UI.

Tokens remain in memory and refresh credentials remain in HttpOnly cookies. No localStorage token persistence, BroadcastChannel, cross-tab locks, new dependencies, or broader permission rules are added.

## Files and customization points

Backend paths are relative to `backend/src/main/java/com/example/task_manager/`:

- `auth/AuthService.java`: registration/login/refresh bind access tokens to the returned family. Logout selects the current session and delegates revocation.
- `auth/RefreshTokenService.java`: session activity lookup, family logout, and existing all-user revocation. Normal rotation retains its stable family ID.
- `auth/RefreshTokenRepository.java`: family-and-user-bound active-session queries.
- `auth/entity/RefreshTokenEntity.java`: index declaration for the active-session lookup.
- `auth/AuthController.java`: passes the optional bearer into logout while retaining Origin/cookie handling.
- `config/jwt/JwtService.java`: token claims and cryptographic validation. Change access-token lifetime in the existing `auth.access-token-expiration-ms` configuration, not by bypassing session checks.
- `config/jwt/JwtAuthFilter.java`: authoritative active-session enforcement on protected requests. Controller execution runs outside the authentication catch block, so unrelated application failures are not misclassified as invalid JWTs.
- `user/UserRepository.java` and `user/UserService.java`: shared credential-row locking and existing all-session revocation calls. Password/reset authority rules are retained.

Frontend paths are relative to `frontend/src/`:

- `features/auth/context/AuthProvider.tsx`: confirmation, cache clearing, pending/error state, and retry/dismiss text.
- `features/auth/api/auth.api.ts`: logout bearer and shared bootstrap refresh.
- `features/auth/utils/authStorage.ts`: in-memory token and session-revision fencing. Refresh replaces a token only if it still belongs to the same local session.
- `api/apiClients.ts`: shared refresh request, automatic retry guards, and stale-request isolation.
- `features/auth/types/auth.types.ts`: asynchronous logout contract and `isLoggingOut`.
- `layout/UserMenu.tsx` and `layout/TopBar.tsx`: sign-out pending state.
- `features/auth/utils/authNavigation.ts`: hard sign-in navigation shared by confirmed logout and unauthorized handling.

To change which actions revoke all sessions, update the service transaction and its HTTP/concurrency tests together. Keep the server-side check authoritative; increasing JWT lifetime must not increase the revocation window. Current account role changes continue to use authorities loaded from the database on protected requests; this phase does not introduce a new role-change revocation policy.

## Existing data and deployment

Existing refresh-token rows already contain family and user identities, so no rows are reset or rewritten. Old access tokens without `sid` are rejected. A still-valid refresh cookie can obtain a new bound access token automatically; otherwise the user signs in again. There is no legacy JWT bypass.

`backend/schema/phase-2e-session-index.sql` adds the lookup index for an existing PostgreSQL database. It has been prepared, not run against the development database. The local Hibernate `update` profile creates the equivalent index when the backend starts. A production database using `ddl-auto=validate` needs the script applied as a deployment step. Run it directly, outside a transaction; PostgreSQL concurrent index creation avoids blocking normal writes. Verify successful index creation before treating deployment as complete.

Deploy the backend consistently: older application instances do not enforce the new active-session check. Do not assume immediate revocation while requests can still reach older instances. This phase changes no signing secrets or cookie policies.

The active-session query adds a database lookup per protected request, supported by the new index. This phase does not claim a load-tested throughput figure, introduce a revocation cache, or add token-history cleanup/retention jobs.

## Verification

Verified on 2026-11-03:

- Backend `mvnw.cmd -B -ntp spotless:apply verify`: 153 tests, zero failures/errors/skips; package and formatter pass. The final source-comment-only change was formatted afterward and included in the Docker build.
- Frontend `npm run test`: 90 tests across 18 files pass.
- Frontend `npm run lint -- --max-warnings 0`: pass.
- Frontend `npm run build`: TypeScript and Vite production build pass.
- Prettier format check and `git diff --check`: pass.
- Java 21 backend Docker build: pass (`team-task-manager-backend:session-check`).
- Node 24/Linux frontend Docker build: pass (`team-task-manager-frontend:session-check`).

The existing main-bundle warning remains (approximately 1.06 MB minified / 309 KB gzip). No dependencies were upgraded in this phase.

New/updated tests:

- `SessionRevocationIntegrationTest`: HTTP-level logout/reset rejection, separate-login isolation, stable family rotation, stale-cookie and bearer-only logout, mismatched session credentials, Origin enforcement, idempotency, own-password/email changes, rejected changes, replay, expiry, required session binding, registration/login cookies, reset/login locking, and logout/refresh races.
- `JwtServiceTest`: session claim binding and required claim validation, plus existing signature/issuer/expiry/identity checks.
- `AuthServiceTest`: authentication-manager handling for unknown accounts and updated session-bound issuance.
- Authenticated module-test fixtures now create real persisted sessions so existing task, archive, team, and notification tests exercise the new security boundary. Their module policies are unchanged.
- `sessionLifecycle.test.ts`: actual Axios interceptor behavior using a test adapter; no live network. Covers shared refresh, stale successes/failures, logout headers and failure, pending logout, concurrent failures, and cross-login retry isolation.
- `AuthProvider.test.tsx`: confirmation before clearing state, failure/retry/dismiss, pending clicks, late bootstrap, and unauthorized cache clearing.

Tests use disposable PostgreSQL 17, not the development database. No browser end-to-end or load test is claimed. Separate-tab coordination, other module-review findings, and the existing bundle-size warning remain deferred.

## References checked

- Repository locks use Spring Data JPA's documented [`@Lock` query support](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html), within service transactions.
- JWT handling uses the installed JJWT 0.13.0 signed-claims and issuer-verification APIs described in its [official documentation](https://github.com/jwtk/jjwt/tree/0.13.0).
- The deployment script follows [PostgreSQL 17 concurrent index creation rules](https://www.postgresql.org/docs/17/sql-createindex.html), including its restriction against transaction-block execution.

## Suggested user commit

`fix: revoke access sessions immediately on logout and password reset`

The assistant does not stage, commit, or push changes.

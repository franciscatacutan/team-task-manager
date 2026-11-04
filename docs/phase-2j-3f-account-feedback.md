# Phase 2J part 3 — account and authentication feedback

Baseline: user commit `6715e81`. Verified November 5, 2026. The user approved separating sign-in validation from new-password rules, locking forms and mode/settings-tab switching during requests, and retaining failed password drafts only in the same form/account. The user committed this verified checkpoint as `1573530`. Phase 2J part 3 remains in progress; the estimate remains four unfinished roadmap parts (2J3 and 2K1–3).

## Validation and backend behavior

Sign-in now requires a valid email and a nonblank password, while the authentication manager still verifies the supplied password against the stored hash. Login no longer applies the password-creation complexity rule. This lets an existing short/nonconforming secret authenticate without making it valid for new accounts or password changes. Password characters are never trimmed or transformed.

Registration and password changes retain the existing server rule: at least eight characters, with uppercase, lowercase, digit and a supported special character. Registration also validates matching confirmation and the existing Unicode name-character rule. Shared frontend schemas now supply these checks to authentication and settings rather than maintaining different six-character/eight-character rules. Identity fields are trimmed as before server normalization; passwords are preserved exactly.

The existing storage bounds are now validated before persistence: first/last names are at most 100 characters and email is at most 150. These bounds are enforced in registration DTOs, login email and self-email update validation, with matching frontend limits. No database schema or password maximum/complexity change was introduced. The registration API type now requires `confirmPassword`, matching the existing backend payload requirement; the cache-consistency test fixture was updated accordingly.

## Feedback and form lifecycle

- Wrong login credentials, service failures, connectivity failures, rate limits, duplicate registration email and session-coordination failures have distinct messages. Server 5xx diagnostic text is not presented as a wrong password or exposed as a user-facing error. Malformed message values fall back to readable text.
- A registration transport failure explains that account creation could have succeeded and suggests trying sign-in before repeating registration. A credential-change transport failure similarly explains the uncertain outcome and asks the user to verify before retrying.
- Authentication and settings validation messages are connected to named fields through `aria-invalid` and `aria-describedby`; required controls and password hints are exposed to assistive technology. Errors are alerts and new server errors scroll into view.
- Password visibility buttons have explicit Show/Hide names, pressed state and a connection to their input. Registration confirmation has a separate named control.
- While submitting, fields, visibility controls, submit and sign-in/register switching are locked. Settings credential requests also lock its tab switching. A synchronous guard prevents duplicate requests, including during asynchronous validation. Failed requests restore controls and retain drafts for explicit retry in that same form.
- Switching sign-in/register modes clears passwords, confirmation, visibility state and old errors while retaining identity fields. Settings tab changes clear credential fields and old errors while retaining a nonsensitive email draft. Changing account/session or leaving the page discards the old editor. Late responses cannot write errors or navigation into a newly mounted editor.
- Same-account background profile refreshes do not erase an open email/password draft. Settings account-read failures now have retry feedback rather than only a sign-in suggestion.

`useSessionFormSubmission` owns the UI pending/duplicate/local-response guards. The existing API/session coordinator, browser Web Locks, token handling, cookie cleanup and sign-out after confirmed credential changes remain responsible for network/session behavior. Its existing single recovery attempt after a confirmed 401 rejection is preserved; this checkpoint adds no automatic retry of uncertain writes. Confirmed email/password changes still sign out the browser's other tabs. UI locks do not block browser navigation.

## Settings tab and preference details

The intended vertical settings navigation now has a bounded full-width list and correctly sized items; it no longer spills into the active panel. The shared `Tabs` wrapper forwards its existing orientation prop to Radix, giving Settings actual vertical semantics and Up/Down keyboard navigation. Other tabs retain their horizontal default.

Appearance choices now expose their selected state and announce confirmed local preference saves. The password-rule hint uses readable contrast. Existing appearance options and persistence remain unchanged.

## Files and customization

| File                                                                              | Controls                                                                                              |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `frontend/src/pages/AuthPage.tsx`                                                 | Sign-in/register UI, connected fields, visibility controls, mode clearing and confirmed navigation    |
| `frontend/src/pages/SettingsPage.tsx`                                             | Account-scoped editor, credential forms, tab/draft clearing, error visibility and preference feedback |
| `frontend/src/common/validation/accountValidation.ts`                             | Shared frontend identity/new-password validation and explanatory text                                 |
| `frontend/src/common/utils/accountRequestError.ts`                                | Error classification and user-facing request messages                                                 |
| `frontend/src/common/hooks/useSessionFormSubmission.ts`                           | UI lock, duplicate prevention and mounted/session response checks                                     |
| `frontend/src/components/ui/tabs.tsx`                                             | Forwarding orientation to the existing Radix primitive                                                |
| `frontend/src/features/auth/api/auth.api.ts`                                      | Existing registration payload type, now including required confirmation                               |
| `backend/src/main/java/com/example/task_manager/auth/dto/LoginRequest.java`       | Required sign-in credentials and email validation                                                     |
| `backend/src/main/java/com/example/task_manager/auth/dto/RegisterRequest.java`    | Existing creation rules plus name/email storage bounds                                                |
| `backend/src/main/java/com/example/task_manager/user/dto/UpdateEmailRequest.java` | Existing self-email contract plus its storage bound                                                   |

Adjust wording in the error/schema helpers, visual layout in the pages, and account-tab spacing in Settings. Password policy changes should be agreed explicitly and implemented in both frontend schemas and the relevant backend DTOs; changing a hint alone does not change server enforcement.

## Verification

- **462 frontend tests in 47 files passed**, including 32 new cases. They use real form/query/mutation hooks and HTTP interceptors, covering sign-in versus new-password validation, normalization without password transformation, Unicode names/storage limits, required confirmation payloads, distinct failures, retained/retried drafts, pending locks, duplicate submits, mode/tab/account clearing, late errors, same-account refreshes, vertical keyboard tabs and confirmed session revocation.
- Backend `spotless:apply verify` passed: **330 tests reported, zero failures/errors, one existing skipped profiling test** (`ActivityNotificationProfileTest`), giving 329 passed tests. Seventeen new cases cover validation contracts and real HTTP authentication with disposable PostgreSQL. A short stored password authenticates exactly, an incorrect password returns 401 and a blank password returns 400; creation/change/reset complexity remains enforced.
- TypeScript, strict ESLint, full Prettier verification, Java formatting, production compilation, both frontend/backend Docker builds and Git whitespace checks passed. The existing frontend large-bundle warning remains.
- `frontend/scripts/check-account-feedback.mjs` runs the real app in headless Edge with mocked HTTP APIs. It covers 390×844 mobile, 390×500 short and 1440×1000 desktop views; service/credential login errors, registration validation/uncertainty, named visibility controls, retained drafts, pending locks, visible errors, clearing on form switches, preference feedback and vertical tab bounds. Confirmed email and password changes each sign out both browser tabs, clearing a peer's password draft.
- **Nine scoped axe scans passed with no exclusions**, including a dark settings state. Screenshots were visually inspected, with no uncaught browser errors. Browser fixtures do not replace real-backend end-to-end, device or screen-reader testing; backend HTTP integration tests ran separately.

Artifacts: `C:/Users/franc/.codex/visualizations/2026/11/02/01a19c10-aef6-7f82-a2e5-f22e00ae0196/phase2j3f`.

No development database, dependency, deployment or permission-policy change was made. Root crash recovery, profile discoverability, operational context DTO alignment and broader accessibility/contrast remain separately scoped review work. Phase 2K still covers release migrations, deployment/recovery and end-to-end/security/load verification.

No staging, commit or push was performed. Suggested user commit: `fix: harden authentication and account form feedback`.

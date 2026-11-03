# Phase 2H, part 2: atomic user editing and profile privacy

Approved decisions: one atomic Save for names/email/permitted global-role edits; profile access for self, global admins, and current teammates sharing a non-archived team; names/email for limited viewers, with global account roles restricted to self/global admins. Baseline: user commit `661eb17` (`fix: centralize query keys and synchronize cached views`).

## Resulting behavior

### One Save, one transaction

The admin edit dialog now sends **one** `PATCH /api/admin/users/{id}` request containing only changed fields. Previously it could save names, then fail changing email or role. The new operation locks the target account, checks every requested field and permission, applies the edits, and revokes sessions if the login email changes, all in one transaction. Invalid fields, forbidden role edits, duplicate emails, or database failures roll back both account changes and session revocations.

Existing rules are preserved: ADMIN can edit USER/ADMIN accounts but cannot manage SUPER_ADMIN; only SUPER_ADMIN can change global roles; SUPER_ADMIN cannot demote themselves. Profile-only self edits continue through `PATCH /api/users/{id}`. Self email still requires the dedicated password-protected flow. Password changes/resets remain separate. Changing names or a global role does not newly revoke sessions; the existing request-time authority lookup continues to use the database role.

The directory and profile edit controls now use the same backend-aligned editing policy. In particular, ADMIN peer-account edits were already allowed by the backend/profile page; the directory action now agrees. ADMIN edit controls for SUPER_ADMIN are hidden. A limited teammate profile never supplies permission to edit the account.

The dialog keeps drafts after errors, resets when reopened or switched to another person, and does not erase an open draft when background queries refresh. It disables unchanged/invalid submissions, fields and dismissal while saving, and guards duplicate submissions. A lost response is reported as uncertain; it does not claim that nothing was saved or automatically replay a write. Successful responses reuse the shared cache update/invalidation and account/workspace guards from part 1.

### Profile access and disclosed fields

| Viewer                                                  | Another person's profile                                          | Global account role |
| ------------------------------------------------------- | ----------------------------------------------------------------- | ------------------- |
| Global ADMIN or SUPER_ADMIN                             | Any profile                                                       | Included            |
| Self                                                    | Own profile, even without teams                                   | Included            |
| Other current member/owner/team admin                   | Only when both currently belong to at least one non-archived team | Omitted             |
| Former/unrelated member, or only a shared archived team | Not found (404)                                                   | Unavailable         |

An unknown UUID and an inaccessible profile return the same not-found message. If another active shared team remains, limited access remains. The full user directory is still global-admin-only.

Profile JSON omits `role` for limited viewers. Team member read/write responses omit other people's `globalRole` for non-global admins; the viewer's own role and all team roles remain available. Add-member candidate summaries keep names/email for the existing authorized team-manager selection flow but omit restricted global roles. Candidate lookup does not grant access to an unrelated person's profile. Non-global admins cannot infer candidate roles through `sort=role`; that sort is rejected. Global admins retain full member/candidate role visibility.

Task assignment/activity identity DTOs already contained names/email without global roles, so those contracts were not rewritten. Existing retained assignment/history identities are not erased. Team roles, ownership, and the narrow super-admin recovery exception are unchanged.

The profile UI hides global-role badges when the field is absent. It stops showing cached profile content after an access rejection, gates team queries until profile access is established, and keeps team-list pagination placeholders within the same profile. Profile/breadcrumb queries do not repeatedly retry 403/404 responses; transient read failures retain retry behavior.

## API and compatibility

- New `PATCH /api/admin/users/{id}` accepts optional `firstName`, `lastName`, `email`, and `role`; returns the complete updated user (200). Supplied names are trimmed/nonblank/up to 100; email is trimmed, normalized and limited to 150. Unsupported/forbidden global-role values are rejected rather than partially applied.
- The existing profile-only endpoint and separate admin email/role/password endpoints remain available. The frontend profile helper no longer performs a hidden second email request. The edit dialog uses the atomic endpoint for another account and the profile-only endpoint for self.
- `GET /api/users/{id}` now authorizes the viewer and can return a limited identity. `role` and member `globalRole` are **optional** for the approved viewers; clients must not manufacture a default role when a field is omitted.
- Existing target-row locks are reused. Legacy profile and role updates now lock the target too, so they cannot bypass the atomic operation's target-row serialization. A concurrent email uniqueness conflict is translated even when Hibernate auto-flushes before querying sessions, not just at the final explicit flush.

No new dependency, schema migration, manual development-data edit, restoration, global permission grant, or cross-tab protocol is introduced.

## Files and customization

Backend paths are relative to `backend/src/main/java/com/example/task_manager/`:

- `user/dto/AdminUpdateUserRequest.java`: atomic request fields, trim and size/email validation. Add fields only with matching field-specific authorization and rollback tests.
- `user/AdminUserController.java` and `UserService.java`: aggregate route/use case, locked target, validation, preserved permission matrix, session revocation and conflict handling. Existing self/credential operations remain separate.
- `user/UserVisibilityPolicy.java`: shared profile-access and global-role disclosure policy. Change this when intentionally changing who may see profiles/roles; presentation-only changes cannot enforce privacy.
- `team/TeamMemberRepository.java`: one database existence check for a current shared non-archived team.
- `user/UserController.java`, `user/dto/UserResponse.java`, and `team/dto/TeamMemberResponse.java`: viewer context and omitted restricted role fields.
- `team/TeamMemberMapper.java`, `TeamService.java`, and `TeamMemberOperations.java`: viewer-aware member/candidate/read/write response mapping. The mapper is an injected component so every path uses the same visibility policy. TeamService also restricts candidate global-role sorting.

Frontend paths are relative to `frontend/src/`:

- `features/users/components/EditUserDialog.tsx`: fresh per-opening editor, one changed-fields request, validation, draft preservation, pending controls and error feedback. Customize dialog layout/copy here.
- `features/users/api/userApi.ts`, `hooks/useAdminUpdateUser.ts`, and `hooks/useUpdateUserProfile.ts`: explicit atomic-admin versus profile-only calls. `common/query/queryCache.ts` shares confirmed identity updates; `common/query/queryKeys.ts` adds the atomic mutation key and profile-scoped team-list identity.
- `features/users/types/userType.ts`: `UserIdentity`, limited `UserProfile`, and strict full `User` are distinct types. Authentication/directory records keep a required role. `utils/userPermissions.ts` is the shared backend-aligned UI editing policy; `utils/userMutationError.ts` controls safe/uncertain error copy.
- `features/users/components/ProfileHeader.tsx`, `UsersList.tsx`, `pages/ProfilePage.tsx`, and `common/components/AppBreadcrumbs.tsx`: limited identity rendering, consistent edit availability, access-error handling and gated profile team views. ProfilePage uses the authenticated user record for permissions.
- `features/users/hooks/useUser.ts` and `features/teams/hooks/useTeams.ts`: no retry for profile 403/404; optional team query enablement and profile-bound placeholders.
- `features/teams/api/teamMemberApi.ts`, `hooks/useAvailableUsers.ts`, `components/AddMemberForm.tsx`, `types/team.type.ts`, `components/MembersList.tsx`, and `common/components/MultiUserSelector.tsx`: name/email-only candidate types and optional member global-role display; selectors do not require or infer global permissions.

The transaction design follows [Spring's rollback semantics](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html) and the existing [Spring Data locking](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html) mechanism. Account changes and session revocation use the same database transaction; there is no asynchronous revocation gap added here.

## Verification

Verified on 2026-11-03:

- Backend `mvnw.cmd -B -ntp verify`: **247 tests**, zero failures/errors/skips; formatting and packaging pass.
- Frontend `npm test`: **203 tests across 32 files** pass.
- Strict frontend ESLint, TypeScript/Vite production build, Prettier check and `git diff --check`: pass.
- Java 21 backend and Node 24/Linux frontend Docker builds: pass (`team-task-manager-backend:user-edit-check`, `team-task-manager-frontend:user-edit-check`).

`UserEditingPrivacyIntegrationTest` adds 47 PostgreSQL-backed cases: full successful saves and login/session effects; management matrix; role injection; duplicate/invalid inputs; no-ops; self-flow restrictions; fixture-scoped database failures during user/session writes; concurrent email collision with one whole success and one whole failure; self/global/shared-team profile access; removal/archiving/unrelated IDs; retained access through another active shared team; directory/anonymous rejection; omitted member/candidate roles; candidate sort restrictions; and member add/role/ownership response privacy. Tests run against disposable PostgreSQL 17 containers. Failure triggers are removed after each test; development data is untouched.

Frontend regressions add 27 cases across `EditUserDialog.test.tsx`, `UserPrivacy.test.tsx`, and `UserPrivacyData.test.tsx`: a single request for names/email/role, profile-only self edits, matching cache updates, rejection/retry/transport uncertainty, duplicate/pending/validation controls, draft retention/reset, backend-aligned permission choices, limited-role rendering, stale-content rejection, query gating, profile-bound placeholders, and access versus transient retry behavior. The prior part-1 cache test is updated from the removed multi-request helper to a lost-response scenario.

Full browser end-to-end/load testing is not claimed. The existing bundle-size warning remains. This phase does not erase information previously seen/cached in another tab/device or provide live broadcasts of membership/role changes; protected backend reads enforce the policy on each request. Cross-tab coordination remains part 3.

## Checkpoint

Phase 2H now has **two completed parts and one remaining proposed part**: cross-tab sessions and remaining loading/error/retry UI states. The roadmap estimates approximately ten unfinished parts overall (one in 2H, three each in 2I–2K). Future work still requires approval.

Suggested user commit: `fix: make user edits atomic and restrict profile visibility`.

The assistant does not stage, commit, or push changes.

# Phase 2C: consistent permissions and ownership recovery

Baseline: `73c5c1b` on `refactor/production-readiness`. The user approved global viewing with team-scoped edits, team creation by global ADMIN and SUPER_ADMIN, owner-controlled team governance, and a narrow SUPER_ADMIN exception for ownership and team-admin recovery. Any current team member may become the owner. This checkpoint remains unstaged and uncommitted for user review.

## Approved access model

Global roles and team roles remain independent:

| Global role | View across teams | Create teams | Recover ownership/admin roles without membership | Other team/project/task edits |
| ----------- | ----------------- | ------------ | ------------------------------------------------ | ----------------------------- |
| USER        | No                | No           | No                                               | Follow team role              |
| ADMIN       | Yes               | Yes          | No                                               | Follow team role              |
| SUPER_ADMIN | Yes               | Yes          | Yes                                              | Follow team role              |

| Team role     | Team details/archive | Ownership/admin-role management | Regular-member management | Project/task management | Task status/comments     |
| ------------- | -------------------- | ------------------------------- | ------------------------- | ----------------------- | ------------------------ |
| OWNER         | Yes                  | Yes                             | Yes                       | Yes                     | Yes                      |
| ADMIN         | No                   | No                              | Yes                       | Yes                     | Yes                      |
| MEMBER        | No                   | No                              | No                        | No                      | Only as assignee/support |
| No membership | No                   | No                              | No                        | No                      | No                       |

SUPER_ADMIN's recovery exception overlays only the ownership/admin-role column. Existing global read privileges remain. Viewing data does not automatically grant edits. The tables describe active teams; archived team writes remain blocked. The previously identified archived-task detail/history inconsistency remains a separate phase.

## Backend changes

- `TeamService` no longer requires a global admin role in addition to ownership when editing or archiving a team. An owner with global USER role can govern that team.
- `validateRoleAdministrator` permits the current owner or SUPER_ADMIN to grant/revoke team-admin roles and transfer ownership. It does not bypass ordinary membership management, team settings/archive, project writes or task writes.
- Adding a member with ADMIN role checks the same admin-role policy. Team admins can add regular members, but cannot bypass the owner-only grant rule by posting an ADMIN role through the add-member endpoint. The existing batch response still returns per-member success/failure results; redesigning that response is deferred.
- Ownership transfer locates the actual owner through the team's owner reference instead of assuming the requester is the owner. This enables a nonmember super admin to recover a team.
- The successor must already belong to the team; their global role is irrelevant. Their global role is not changed by becoming owner. No membership is created for the recovery actor.
- Existing protections remain: the current owner cannot be reassigned to themselves; OWNER cannot be set through the generic role endpoint; self-role changes are rejected; a team must be active. The transfer remains in one transaction with existing optimistic version checks.
- The old owner becomes a team ADMIN, the successor becomes the sole OWNER, and `TeamEntity.owner` and timestamps update together. Existing activity/audit/notification recording identifies the actual actor and the actual old/new owners.

Recovery is an explicit super-admin action. This phase does not automatically detect inactivity, disable the former owner's account, or remove their membership. If the former owner also needs removal, the new owner can use the normal membership flow.

## Frontend changes

- Team creation is visible to both global admin roles. Owner-only team settings/archive controls follow the team role, not the global role.
- Role selectors and ownership transfer are available to SUPER_ADMIN for recovery even without membership. The member directory no longer renders blank merely because a global admin has a null team role.
- Team admins have regular-member management controls, but cannot grant/revoke ADMIN roles or remove another admin. The UI no longer offers those invalid removal actions. Owner rows retain their protections.
- The transfer dialog offers any eligible current member, including global USER accounts. It uses server-backed search across member names/emails rather than restricting successors to global admins on the currently displayed member page.
- Recovery copy explains that the former owner becomes an admin. The form requires TRANSFER confirmation, resets selection/confirmation when reopened, and displays load/mutation errors without silently closing.
- The shared `UserSelector` supports optional controlled search for the transfer flow. Existing callers retain local filtering. Its combobox now has an accessible name derived from the placeholder.
- Project status edits require team management. Global viewing alone no longer enables that write control.
- Task permissions require an actual current team role and an actual matching identity for assignee/support actions. Two missing IDs no longer count as an assignment. Board dragging receives the same per-task permission decision and rejects unauthorized status changes.
- Ownership and role mutations invalidate the local `team-me`, members, all-members and team-activity queries; transfer also refreshes team lists/details. The acting user's controls update after losing ownership. Cross-browser realtime permission broadcasts are not introduced.

## Where to customize the rules

| File                                                                                                                      | Responsibility                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/main/java/com/example/task_manager/team/TeamService.java`                                                    | Authoritative team governance, admin grants, recovery authorization and ownership invariants. The narrow exception is `validateRoleAdministrator`; ordinary team writes still use owner/manager checks. |
| `frontend/src/features/teams/utils/teamPermissions.ts`                                                                    | Mirrors the approved team/global role matrix for visible controls.                                                                                                                                      |
| `frontend/src/features/projects/utils/projectPermissions.ts`                                                              | Project read/management controls.                                                                                                                                                                       |
| `frontend/src/features/tasks/utils/taskPermissions.ts`                                                                    | Task management, assignee/support and read-only controls.                                                                                                                                               |
| `frontend/src/features/teams/components/MembersView.tsx` and `MembersList.tsx`                                            | Global directory viewing, recovery controls, self/owner protections and per-target removal controls.                                                                                                    |
| `frontend/src/features/teams/components/TransferOwnershipModal.tsx`                                                       | Eligible-member search, ordinary transfer versus recovery copy, confirmation, reset and error feedback.                                                                                                 |
| `frontend/src/common/components/UserSelector.tsx`                                                                         | Local search by default; optional controlled search for remote results.                                                                                                                                 |
| `frontend/src/features/teams/hooks/useTransferOwnership.ts` and `useUpdateMemberRole.ts`                                  | Local cache refresh after ownership/admin-role changes.                                                                                                                                                 |
| `frontend/src/features/tasks/components/TaskBoard.tsx` and `frontend/src/features/projects/components/ProjectDetails.tsx` | Permission-aware board dragging.                                                                                                                                                                        |

When changing a role rule, update its backend guard, frontend helper/control and positive/negative regression tests together. Avoid replacing owner/manager checks with a blanket global-admin bypass. No dependency, schema or task/project naming change is included.

## Verification

- Backend: **79 tests passed**, zero failures/errors/skips; Spotless check, compilation and executable JAR packaging pass. The 27 new integration cases use disposable PostgreSQL and real HTTP/security/persistence flows.
- Frontend: **43 tests passed**, strict zero-warning lint, TypeScript/production build and formatting checks pass. New tests cover the permission matrix, global member-directory viewing, recovery controls, ordinary-member successors, confirmation reset/error feedback, and both shared selector search modes.
- Both Docker images build: Java 21 backend and Node 24 frontend. Local Maven verification uses JDK 25 targeting Java 21.

Backend cases include global team creation; ordinary-owner settings/archive; nonowner denials; global viewing without membership; team-admin scope; project/task edit denials for nonmember global admins; regular-member management; blocked ADMIN-grant bypass; owner-to-ordinary-member transfer; super-admin recovery with/without membership; unchanged global roles; no automatic recovery-actor membership; a single owner; actual actor/from/to values in activity/audit; and archived/self/owner protections.

Commands:

```powershell
cd backend
.\mvnw.cmd -B -ntp verify
```

```powershell
cd frontend
npm test
npm run lint -- --max-warnings 0
npm run build
npm run format:check
```

The existing Vite bundle-size warning remains. Browser end-to-end and load/concurrency suites were not run for this batch; the recovery and role boundaries are covered by HTTP/PostgreSQL integration and component tests.

## Deferred work

Archive semantics/detail/history consistency, session invalidation, general query-key cleanup, task assignment clearing/member selection, notification/activity pagination, batch feedback, database migrations and broader module restructuring require separate approval. This phase does not expand SUPER_ADMIN into unrestricted team administration or project/task editing.

Suggested user-owned commit message:

```text
fix: align team permissions and add super-admin ownership recovery
```

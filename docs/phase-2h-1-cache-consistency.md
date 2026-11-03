# Phase 2H, part 1: shared query keys and consistent cached views

Approved scope: shared query keys, refreshes for profiles/activity/lists/insights after saves, and confirmed server results for sensitive changes. Baseline: user commit `123d218` (`fix: align task assignments, contracts and board workflows`). This completes **one of the three planned Phase 2H parts**, not all of Phase 2H.

## Problems and resulting behavior

- **Individual profiles stayed stale after saves.** The old profile/role hooks refreshed the directory and current-user query, but omitted `['user', userId]`. The profile now receives the confirmed response and is refreshed along with the directory and affected embedded identity summaries. The current-user summary is updated only when its ID matches the edited person; editing someone else cannot replace the signed-in administrator.
- **Project history refreshes targeted the wrong key.** The actual history hook read `projectActivities`, while most project/task mutations invalidated `projectActivity`. All readers and refreshes now share one definition. The comment hook already had the correct plural key; the earlier review summary incorrectly attributed the mismatch to that hook.
- **Breadcrumb and detail views duplicated task data.** The breadcrumb used the route's string task number and detail hooks used a number. Both now use the numeric task key, so a rename/status refresh reaches the same entry and the initial fetch is shared. Invalid route task numbers do not trigger breadcrumb requests.
- **Refresh coverage varied between writes.** Task changes now refresh the relevant detail, list, board columns, task/project/team activity, audit/system-event views, and insights. Project/team changes follow the same dependency rules. Membership/ownership/role changes refresh actual team permission and selection queries. Archive refreshes reach cached descendants within the affected workspace instead of invalidating unrelated workspaces globally. Team directory queries remain shared because they summarize multiple teams.
- **Uncertain network outcomes left stale data behind.** Business mutation refreshes now run on settlement, including failed/lost responses, without automatically retrying a write. A request can fail after the server committed it; refetching reveals actual state. A successful save remains pending while mounted views refresh. A failed read does not reclassify an already successful write as failed; inactive entries are marked stale for the next mount.
- **Confirmed responses could race with older reads or navigation.** An older detail read is canceled in the query cache before the confirmed response is installed. Mutation keys identify the operation and bound workspace/entity, so navigating to another task/project does not retarget a pending save or write its response into the new screen's cache. Default offline queuing is retained; a queued request remains tied to its original workspace.
- **Responses from an old login could repopulate cleared data.** Cache callbacks check the existing same-tab session revision. Queued requests cannot execute under a different login; late callbacks cannot fill or invalidate the next account's cache. Confirmed login/registration cancel previous reads, clear previous account data, then seed the current-user entry. This uses the existing in-memory token/revision system; it does not add cross-tab coordination or change backend authorization/session rules.
- **Placeholder rows could belong to another workspace.** Pagination can retain prior rows within the same team/project/task, but switching workspace no longer presents the previous workspace's rows while the new query loads.

## Implementation and customization

All source paths below are relative to `frontend/`:

- `src/common/query/queryKeys.ts` is the single query/mutation identity registry. Existing resource prefixes are retained where practical; paginated keys include the full filter object. Ordinary member lists and infinite member selectors remain distinct. Task detail numbers are numeric. Add new filters to the hook's parameter object and include that object in its full key; use prefix builders for invalidation.
- `src/common/query/queryCache.ts` defines the dependency map: team changes, project changes, task changes, descendant archive/workspace refreshes, membership changes, user identity changes, and notifications. Customize which views refresh here rather than repeating string arrays in individual hooks. `setConfirmedData` handles the read/response race, and `keepPreviousDataInScope` controls placeholder reuse.
- `src/common/query/useAppMutation.ts` wraps the installed TanStack mutation hook with required operation identity, explicit no-write-retry behavior, and same-tab account checks. It does not optimistically grant roles or patch filtered list membership. Keep the operation key tied to every scope captured by the request function. Callers retain their normal `mutate`, `mutateAsync`, pending/error state, and per-call UI callbacks.
- Read hooks under `src/features/{teams,projects,tasks,users,notifications,auth}/hooks/` and `src/common/components/AppBreadcrumbs.tsx` use the registry. Most changes in these files are key-builder imports and key replacement, not module/business-rule rewrites.
- Team/project/task/user/notification mutation hooks use the shared mutation/cache helpers. Where the API returns a complete Team/Project/Task/User, that response seeds the matching detail entry. Void/partial responses such as role/ownership operations trigger refetches without fabricating a complete entity or permission result. The old `features/teams/utils/invalidateMembership.ts` implementation moves into the shared dependency map; membership batch semantics are unchanged.
- `src/features/auth/hooks/useLogin.ts` and `useRegister.ts` isolate account caches on successful authentication. `AuthProvider.tsx` only switches its current-user cache references to the registry; its logout/bootstrap protocol remains in place.
- `eslint.config.js` rejects literal array keys in query definitions and direct cache access in application source. Use the shared builders. Tests may intentionally construct raw keys to verify compatibility and prove old phantom entries stay absent.

User summaries appear in team owners/members, project creators, task assignees/support, and activity actors. The user response does not enumerate all affected teams, so profile/role edits deliberately invalidate these identity-bearing query families across workspaces. Ordinary task/project changes and archive descendants remain scoped. This is a correctness tradeoff for infrequent identity edits, not a claim of minimal possible network traffic. General event-delivery/performance measurement remains later work.

The design follows the installed library's documented [query identities](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [mutation response updates](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses), and [awaited invalidation callbacks](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations). No new dependency is introduced.

## Verification

Verified on 2026-11-03:

- `npm test`: **176 tests across 29 files** pass, including 29 new cache-consistency cases.
- `npm run lint -- --max-warnings 0`: pass.
- `npm run build`: TypeScript and production Vite build pass.
- `npm run format:check` and `git diff --check`: pass.
- Frontend Node 24/Linux Docker build: pass (`team-task-manager-frontend:cache-check`).
- Direct ESLint probes confirm raw query/cache array keys are rejected and factory usage is accepted.

`src/common/query/QueryConsistency.test.tsx` mounts real QueryClients and query/mutation hooks with mocked HTTP boundaries. It checks profile/directory/member observers, matching-current-user protection, partially committed existing edits, server-confirmed roles, list/board/history/insights refreshes, write-pending versus refresh failures, older-read cancellation, ownership permissions, archive scoping, late success/failure responses after account changes, cancellation races, account cache clearing, scoped placeholders, breadcrumb/detail fetch sharing, lost-response recovery without write retries, navigation during a save, and offline workspace/account races. The archive cache fixture is corrected to use the real plural project history key rather than a key no screen observed.

Backend source, API contracts, database schema/data, dependencies, and authorization policies are unchanged. The previously verified 200 backend tests are not claimed as newly rerun for this frontend-only change. Full browser end-to-end/load testing is not claimed. The existing large-bundle build warning remains.

## Remaining Phase 2H work

- **Part 2:** make multi-field user editing consistently atomic and agree on directory/privacy policy. The current profile/email/role sequence can still partly commit; this part refreshes that actual state after failure but does not pretend the sequence is transactional.
- **Part 3:** cross-tab refresh/logout coordination and the remaining loading/error/retry UI states. The cache safeguards here operate within one tab. Other users/devices do not receive live cache broadcasts; backend access checks remain authoritative.

See the [roadmap](production-readiness-roadmap.md). Approximately 11 planned parts remain: two in Phase 2H and three each in 2I–2K. Future parts still require approval.

## Review checkpoint

Suggested user commit: `fix: centralize query keys and synchronize cached views`.

The assistant does not stage, commit, or push changes.

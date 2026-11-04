# Phase 2I, part 1: complete notification inbox

Implemented November 4, 2026 against user commit `e2c6270` (`fix: synchronize browser sessions and preserve failed edits`). Approved scope: notification pagination, unread filtering across the full inbox, accurate totals, read-state refreshes, failure/retry feedback, and regression tests. All changes remain for the user's review and commit.

## Before and after

Previously the notification center always fetched page 0 with 12 items. The Unread button filtered those 12 records in memory, even though the badge counted every unread notification in the database. For example, 12 recent read items could hide three older unread items while the badge still showed three. Requests could fail and render as an empty inbox; rejected mark-as-read operations had no visible feedback.

The inbox now requests the selected page and filter from the server. With that same example, All shows 15 notifications across two pages and Unread shows the three older unread items. Page controls expose older records, switching All/Unread resets to page one, and the footer shows the selected filter's total and page. No previous-filter placeholder rows are displayed while another filter loads.

Read all continues to mean **all unread notifications belonging to the current recipient**, including records outside the visible page or filter. It does not change another account's records. Reading one item remains recipient-scoped and idempotent. These semantics and recipient/delivery rules were not changed.

## Backend changes

- `GET /api/notifications` accepts optional `unreadOnly=true`; omitted or false retains the full recipient inbox. The repository applies recipient ownership and unread filtering before pagination, so `totalElements` and `totalPages` describe the same result set as `content`.
- Default requests now return 12 items, newest first (`createdAt,desc`), matching the existing notification UI size. Explicit `page`, `size`, and supported `sort` requests remain available. UUID descending is appended as a deterministic tie-breaker when no ID order is supplied, preventing equal timestamps from arbitrarily shuffling stable pages.
- Supported sort fields are notification fields `createdAt`, `readAt`, `id`, `type`, and `title`. Unknown or nested identity/security fields are rejected with 400 rather than producing repository errors or accepting arbitrary entity traversal. Invalid boolean input is also a client error.
- Existing unread-count and read endpoints remain unchanged. No entity/schema/index migration, recipient expansion, notification deletion, delivery mechanism, or history-retention change is included.

Example: `GET /api/notifications?page=1&size=12&unreadOnly=true&sort=createdAt,desc`. Page numbers remain zero-based in the API and one-based in the UI. Generic notification `title` remains the existing display headline; task/project domain names still use `name`.

## Frontend flow and failures

1. The badge continues polling the full recipient unread count every 30 seconds. Inbox page requests run only while the popover is open and also poll every 30 seconds. Cache freshness remains 10 seconds; reopening a stale inbox refreshes it.
2. A page query key contains its complete page/size/filter/sort request. All and Unread pages have distinct identities under the shared notification invalidation prefix. Axios requests consume the query's abort signal, so cancellation prevents late page/count responses from installing obsolete results.
3. Single-read and Read all actions retain the existing shared mutation revision guards and invalidate every inbox variant plus the count after settlement. Active views refetch; inactive pages remain stale until needed. Read all also adopts its confirmed server count after canceling an older count read. It does not manufacture a constant zero or let a previous account's result overwrite a replacement cache.
4. If polling or read changes shrink the unread result set, an out-of-range page moves to the last valid page and loads it. Clearing the entire unread inbox returns to page one, then displays a confirmed empty state.
5. A failed list shows Error/Retry, not a false empty inbox. Failed or still-loading unread counts are labeled unavailable/checking, not caught up. Count failure has its own Retry and disables Read all until its count is known.
6. Opening an unread item first awaits confirmed mark-as-read and cache refresh. Failure keeps the popover open with a visible error; clicking the item again retries. Confirmed success closes and navigates. Already-read items navigate without another write. A changed account/session prevents an old pending read from navigating afterward.
7. Read actions disable competing item/filter/page/read-all controls and dismissal while pending; an in-flight guard prevents duplicate submissions. Failed Read all remains visible and can be retried. Uncertain network responses say to refresh before retrying; writes are not automatically replayed for network errors.
8. The popover is bounded to the viewport width. Existing shared shadcn/Radix buttons, popover, and query-error presentation are reused; no application dependency or lockfile changed.

Counts and pages are separate HTTP reads, not one atomic inbox snapshot. A new delivery or another tab's read can change them between responses. Local mutations invalidate/refetch them, and polling/focus/reopening reconciles other changes. Offset pagination is deterministic for a stable dataset; concurrent insertion or reading can shift page boundaries. Real-time cross-tab read broadcasts and cursor/snapshot pagination were not added silently.

## Files and customization

| File                                                                                                | What it controls                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/main/java/com/example/task_manager/notification/NotificationController.java`           | Optional `unreadOnly`, default page size and newest-first order. Change the API default here when intentionally changing clients' default batch size.                      |
| `backend/src/main/java/com/example/task_manager/notification/NotificationRepository.java`           | Recipient-owned filtered page/count query; read actions and full unread count keep their original ownership scope.                                                         |
| `backend/src/main/java/com/example/task_manager/notification/NotificationService.java`              | Sort allowlist, deterministic ID tie-breaker and page metadata. Notification generation/copy/destination code is unchanged.                                                |
| `frontend/src/features/notifications/types/notification.types.ts`                                   | Typed page/filter/sort request contract (`NotificationInboxParams`).                                                                                                       |
| `frontend/src/features/notifications/api/notificationApi.ts`                                        | Filtered API request and cancellation signals for inbox/count reads.                                                                                                       |
| `frontend/src/common/query/queryKeys.ts`                                                            | Parameterized inbox page keys, preserving the shared invalidation prefix.                                                                                                  |
| `frontend/src/features/notifications/hooks/useNotifications.ts`                                     | Frontend page size (12), default sort, enabled/open behavior, polling (30 seconds), and freshness (10 seconds).                                                            |
| `frontend/src/features/notifications/hooks/useUnreadNotificationCount.ts`                           | Badge polling/freshness and count cancellation signal.                                                                                                                     |
| `frontend/src/features/notifications/hooks/useMarkAllNotificationsRead.ts`                          | Confirmed server-count adoption before existing notification invalidation. Single-read already used the shared invalidation/session guard and remains unchanged.           |
| `frontend/src/features/notifications/components/NotificationCenter.tsx`                             | Filter/page state, page recovery, navigation guard, pending controls, footer, mobile bounds, and error/retry wording.                                                      |
| `backend/src/test/java/com/example/task_manager/notification/NotificationInboxIntegrationTest.java` | HTTP/PostgreSQL regression fixtures and recipient/paging/filter/read/sort checks. Existing `NotificationServiceTest.java` is adapted to the filtered repository signature. |
| `frontend/src/features/notifications/components/NotificationCenter.test.tsx`                        | UI plus real query/mutation hook tests with mocked API results, cancellation and account-switch cases.                                                                     |
| `frontend/scripts/check-notification-inbox.mjs`                                                     | Optional native-browser check with isolated mocked APIs, following the existing session-check script pattern.                                                              |

Keep the frontend request size and backend default consistent if changing the batch size. Changing polling is a product/performance tradeoff; notification write-path cost and delivery design remain in part 3. Changing who receives/retains notifications requires separate authorization, not only a UI filter.

## Verification

- **258 backend tests pass, zero skipped**, including 11 new PostgreSQL/HTTP inbox cases: older unread items beyond the first 12, recipient isolation, page/count agreement, tied timestamps, supported/default ordering, idempotent owned single-read, full-inbox Read all and later delivery, empty/out-of-range metadata, case-insensitive email lookup, and invalid sort/filter inputs. Existing former-member notification regressions pass too.
- **254 frontend tests pass in 35 files**, including 15 new notification cases: on-demand paging, server filtering, distinct filter caches/loading, list/count error recovery, read failures/retry, pending/duplicate controls, full-inbox Read all, shrinking-page recovery, uncertain responses, old-account navigation/cache guards, inactive page invalidation, and cancellation of an older unread count.
- Prettier, Spotless, strict ESLint (zero warnings), TypeScript/production compilation, backend Maven verification/package, and both Docker image builds pass. The existing large frontend JavaScript chunk warning remains for the later structure/performance work.
- Native Edge check passes with the actual React app and mocked API: page two is reachable, older unread records appear, filtering resets the page, unread count/read/read-all retries work, empty-unread wording is accurate, list Retry recovers, and there are zero page JavaScript errors. Desktop screenshot and mobile 390px and 320px widths were checked; the inbox fits those viewports.
- Optional reproduction: run an isolated Vite server on `127.0.0.1:4187` with `VITE_API_URL=http://127.0.0.1:4187`; install Playwright into a temporary directory outside the checkout; from `frontend`, run `node scripts/check-notification-inbox.mjs <temporary-directory>`. Windows defaults to installed Edge; `TTM_TEST_BROWSER` selects another executable. `TTM_TEST_SCREENSHOTS` optionally writes screenshots into an existing directory. This script is not a new app dependency or CI requirement.
- Backend integration tests use disposable PostgreSQL 17 Testcontainers. Browser APIs are mocked in a separate browser context. The development database was not reset, seeded, or manually edited. Browser plus real backend E2E/security/load verification remains in 2K.
- No staging, commit, or push was performed.

## Review checkpoint and remaining scope

Suggested user commit message: `fix: paginate notifications and synchronize unread state`.

Next proposed work is **Phase 2I part 2: activity history search/grouping, navigation, and inaccessible destinations**. That work needs approval. Current destination resolution and notification retention are preserved here; for example, an old removal notice may still point to a team the recipient can no longer open. Delivery/performance design remains part 3. Three phases remain in progress/planned (2I–2K), with approximately **eight unfinished parts**: two in 2I and three each in 2J/2K. This checkpoint does not certify production readiness.

# Phase 2J part 3 — mobile and keyboard navigation checkpoint

Baseline: user commit `dd2afd0`. Approved scope: mobile workspace navigation, keyboard-accessible team/project/task links and sorting, separate task open/drag controls and accessible control names. The user chose a **mobile drawer**, retaining the collapsible desktop sidebar. The user committed this verified checkpoint as `a4bad9e`. Other Phase 2J3 audit findings remain separate work.

## What changed

### Mobile drawer and shared workspace navigation

Below 768px, the workspace shows a named menu button and the current team instead of reserving sidebar width. The drawer uses existing Radix/shadcn dialog primitives, with keyboard focus containment, Escape/backdrop/Close dismissal and focus return to its trigger. Selecting a navigation link or another team closes it. Route changes and resizing to desktop also clear open state, so browser Back or a later mobile resize does not resurrect an old drawer.

Desktop keeps its 200px expanded / 72px collapsed sidebar. Collapse state is independent of mobile open state and survives switching between those layouts within the mounted workspace; it is not saved as a browser preference. Collapsed links retain accessible names and have tooltips. The same extracted `TeamNavigation` supplies both layouts, using the existing Insights visibility rule.

The workspace content is now the full **390px** width in the mobile probe, instead of the prior 190px remainder. Loading layout follows the same responsive structure, provides a loading announcement and avoids fixed-width skeleton overflow. The inner workspace is a labeled section rather than a second nested `main` landmark.

The team switcher uses Popover + Command semantics rather than embedding a listbox/search input in a dropdown menu. Its trigger/search/popup are named; search matches visible team names and keys. Its Create Team entry now uses the existing global ADMIN/SUPER_ADMIN rule, including inside the drawer. Ordinary team owners/members are no longer offered that unsupported action. No permission was expanded. Creating a team remains available to authorized users through a nested creation dialog.

### Native navigation links and sorting buttons

Team/project board cards, team overview metric cards and team/project/task list names now expose actual router links. Keyboard Enter and ordinary link actions work. List rows retain their supplemental pointer-click behavior; clicking the contained link does not trigger a second row navigation. Task list links still open the full task route; board task names open the existing dialog.

The shared sort header now renders a focusable native button inside the header cell. Enter and Space call the existing sort handler; `aria-sort` still reports the selected direction. Member-list headers reuse this pattern with their existing field names and direction rules. Stable field keys replace missing mapped-header keys.

Named controls include sidebar collapse/expand, team switching/search, user/member action menus, the user menu, sort-direction toggles and pagination arrows. The current numbered pagination button also exposes `aria-current`. No user-profile entry points, search-policy changes or unrelated forms were added in this batch.

### Separate task opening and dragging

Each board task has a named **Open task** button on its name and a separate **Move task** handle. Only the handle receives dnd-kit listeners/attributes and its activator ref. Enter on the task name opens the dialog; Space/arrow keys on the handle move it. The existing pointer-distance threshold, transition validation, selected columns, read-only rules and server-confirmed status mutation remain.

`touch-action: none` is restricted to the handle, allowing the rest of a card to participate in normal scrolling. Drag previews contain no duplicate interactive controls. The DOM wrapper still owns sortable geometry.

The browser run exposed a focus gap after a confirmed keyboard move remounted the task in another column. The board now waits for mutation/cache settlement and the rendered pending state before focusing the moved handle (or its open action if movement is no longer available). It checks the board/scope/request and leaves focus alone if the user has moved to another control. The parent returns the existing mutation promise; request errors remain displayed by the existing mutation UI and do not become unhandled promises.

Keyboard movement probes wait for the new drop target to be rendered/announced before dropping; they do not assume synchronous animation/collision updates.

## Files and customization

All paths below are under `frontend/`.

| File                                                                                                                                                      | Responsibility / customization point                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/hooks/useIsMobile.ts`                                                                                                                         | React external-store subscription to `(max-width: 767px)`. Keep this aligned with Tailwind's `md` breakpoint. No resize polling or package addition. |
| `src/features/teams/components/TeamSidebar.tsx`                                                                                                           | Drawer chrome/dimensions, desktop collapse, route/resize closing and team permission wiring.                                                         |
| `src/features/teams/components/TeamNavigation.tsx`                                                                                                        | Shared destination list, icon labels and Insights visibility for both layouts.                                                                       |
| `src/features/teams/components/TeamNavItem.tsx`                                                                                                           | Native nav links, active styles, focus ring, collapsed accessible names and tooltips.                                                                |
| `src/features/teams/components/TeamSwitcher.tsx`                                                                                                          | Popover/Command behavior, team search/selection, accessible names and existing global creation permission. Its existing API page size is unchanged.  |
| `src/layout/workspace/{WorkspaceLayout,WorkspaceSkeleton}.tsx`                                                                                            | Column-to-row responsive layout, full-width content region and matching loading state.                                                               |
| `src/features/teams/components/{TeamCard,TeamsBoard,TeamsList,TeamOverviewCard,TeamOverview}.tsx`                                                         | Team/overview links.                                                                                                                                 |
| `src/features/projects/components/{ProjectCard,ProjectsBoard,ProjectsList,ProjectsView}.tsx`                                                              | Project links with explicit parent team routing context; invalid workspace guard.                                                                    |
| `src/features/tasks/components/{TaskCard,TaskBoard,TaskList}.tsx`                                                                                         | Task open action, handle/preview, keyboard drop focus lifecycle and list links.                                                                      |
| `src/features/projects/components/ProjectDetails.tsx`                                                                                                     | Supplies the existing status mutation promise and pending state to the board.                                                                        |
| `src/common/components/toolbar/SortHeader.tsx`, `src/features/teams/components/MembersList.tsx`                                                           | Native sort buttons and existing server field/direction callbacks.                                                                                   |
| `src/common/components/{toolbar/SortControl,pagination/PaginationControls}.tsx`, `src/features/users/components/UsersList.tsx`, `src/layout/UserMenu.tsx` | Contextual accessible names, current-page semantics and stable action/header keys.                                                                   |

Some card diffs are larger mechanically because a real link wraps the existing card markup and Prettier reindents it. Content fields, task/project `name`, styling direction, API resource identities and mutation policy stay in place. Board-card pointer opening is now explicitly on the task-name action; dragging starts only from the handle, as approved.

## Verification

- **381 frontend tests in 42 files pass**, up from 358. The existing keyboard movement tests now use the real TaskCard; 23 new cases cover drawer focus/dismissal, route/Back behavior, resizing/collapse independence, named links, switcher name search/role visibility, native card/list hrefs and keyboard activation, single row navigation, Enter/Space sorting, read-only opening versus dragging, and post-mutation focus without stealing a later user focus. The drop-event test fixture now includes its required activator event.
- TypeScript, ESLint with zero warnings, repository Prettier check, production compilation and frontend Docker build pass (`team-task-manager-frontend:phase2j3b`). `git diff --check` passes.
- Native Edge probe uses the real app and generated API fixtures. It verifies 390px full-width content, a matching held-request loading layout, drawer focus trapping/restoration and Escape/backdrop/link/route closing, team-name search/switching, authorized nested team creation, desktop collapse preservation, card/list links, Enter/Space sorting, task opening without a mutation, and **two confirmed workflow moves** (keyboard To Do → In Progress; pointer In Progress → In Review), including restored keyboard focus.
- Four scoped axe scans report zero detected violations: mobile drawer, open team switcher, collapsed desktop sidebar and short dark drawer. Screenshots were inspected at 1440×1000, 390×844 and 390×500. No uncaught browser page errors or unexpected browser console warnings remained in the probe.
- Optional probe: start Vite at `127.0.0.1:4187` with `VITE_API_URL=http://127.0.0.1:4187`, install `playwright` and `@axe-core/playwright` together in a temporary directory outside the repository, then run `node scripts/check-workspace-navigation.mjs <temporary directory>`. `TTM_TEST_BROWSER` overrides the default Windows Edge path; `TTM_TEST_SCREENSHOTS` names an existing output directory. No test tool was added as an application dependency.

The implementation uses the existing [Radix Dialog focus and keyboard primitives](https://www.radix-ui.com/primitives/docs/components/dialog). The dedicated handle follows the activator/listener/ref separation in the installed dnd-kit sortable API, also visible in its [upstream hook](https://github.com/clauderic/dnd-kit/blob/master/packages/sortable/src/hooks/useSortable.ts); this checkpoint does not migrate to a different dnd-kit package generation.

No backend/schema/dependency/development-data changes were needed. Backend tests were not rerun for this frontend checkpoint. Browser APIs are mocked; viewport/keyboard/pointer checks do not replace real-backend or physical-device/multi-browser verification. The existing large-JavaScript-chunk production-build warning remains. HEAD stays `dd2afd0`; nothing is staged, committed or pushed.

## Remaining work

The navigation, mobile sidebar, keyboard sorting/opening, relevant icon naming and switcher visibility/semantics findings are addressed. Other audit items remain: comment/log error feedback, account/member/ownership dialog policies and sizing, operational DTO context, profile entry points, broader contrast/validation feedback and root crash recovery. Accurate search labels outside the directory and any larger switcher pagination work remain separate scope.

Recommended next checkpoint: failed comment/log feedback, with explicit choices before any delivery, recipient or API-context policy changes. **Phase 2J3 remains in progress; approximately four roadmap parts remain** (2J3 and 2K1–3). This checkpoint is not production-readiness sign-off.

Suggested user commit: `feat: add mobile workspace drawer and keyboard navigation`.

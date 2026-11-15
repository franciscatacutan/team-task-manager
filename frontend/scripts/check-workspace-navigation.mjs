// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-workspace-navigation.mjs <temporary Playwright + @axe-core/playwright installation>
// APIs are mocked. This probe never changes development data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
if (!process.argv[2])
  throw new Error("Pass the temporary browser-test installation directory.");
const require = createRequire(resolve(process.argv[2], "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const browser = await chromium.launch({
  executablePath:
    process.env.TTM_TEST_BROWSER ??
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : undefined),
  headless: true,
});
try {
  const base = "http://127.0.0.1:4187",
    errors = [],
    warnings = [],
    writes = [],
    scans = [];
  const user = {
      id: "owner",
      userId: "owner",
      firstName: "Browser",
      lastName: "Owner",
      email: "owner@example.test",
      role: "ADMIN",
    },
    date = "2026-11-04T00:00:00Z";
  const team = {
    key: "TEAM",
    name: "Customer delivery",
    description: "Coordinate the customer portal launch.",
    owner: user,
    createdBy: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  const other = { ...team, key: "OTHER", name: "Platform operations" };
  const project = {
    key: "PROJECT",
    teamKey: "TEAM",
    name: "Customer portal",
    description: "Prepare delivery.",
    status: "ACTIVE",
    owner: user,
    createdBy: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  let holdTeam = false,
    releaseTeam;
  let task = {
    taskNumber: 7,
    name: "Review delivery plan",
    description: "Confirm the scope and schedule.",
    status: "TODO",
    priority: "MEDIUM",
    assignedUser: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: user.email, userId: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock`;
  const paged = (content) => ({
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    last: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route(`${base}/api/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === "/api/auth/refresh")
      return route.fulfill({ json: { token, user, expiresInSeconds: 900 } });
    if (path === "/api/users/me") return route.fulfill({ json: user });
    if (path === "/api/teams")
      return route.fulfill({ json: paged([team, other]) });
    if (holdTeam && path === "/api/teams/TEAM")
      await new Promise((resolve) => {
        releaseTeam = resolve;
      });
    if (/^\/api\/teams\/(TEAM|OTHER)$/.test(path))
      return route.fulfill({ json: path.endsWith("OTHER") ? other : team });
    if (path.endsWith("/me"))
      return route.fulfill({ json: { userId: user.id, role: "OWNER" } });
    if (path.endsWith("/projects"))
      return route.fulfill({ json: paged([project]) });
    if (path === "/api/teams/TEAM/projects/PROJECT")
      return route.fulfill({ json: project });
    if (path.endsWith("/tasks/7/status") && request.method() === "PATCH") {
      const body = request.postDataJSON();
      writes.push(body);
      task = { ...task, status: body.status };
      return route.fulfill({ json: task });
    }
    if (path.endsWith("/tasks/7")) return route.fulfill({ json: task });
    if (path.endsWith("/tasks")) {
      const statuses = url.searchParams.getAll("status");
      return route.fulfill({
        json: paged(
          !statuses.length || statuses.includes(task.status) ? [task] : [],
        ),
      });
    }
    if (path.endsWith("/members"))
      return route.fulfill({
        json: paged([{ ...user, teamRole: "OWNER", joinedAt: date }]),
      });
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 0 } });
    if (path.endsWith("/insights/summary"))
      return route.fulfill({ json: null });
    return route.fulfill({ json: paged([]) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      warnings.push(message.text());
  });
  async function settle() {
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      );
    });
  }
  async function shot(name) {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(process.env.TTM_TEST_SCREENSHOTS, name),
      });
  }
  async function audit(selector, state) {
    await settle();
    const result = await new AxeBuilder({ page })
      .include(selector)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }));
    assert.deepEqual(violations, [], state);
    scans.push({ state, violations });
  }
  const menu = () =>
    page.getByRole("button", {
      name: "Open workspace navigation",
      exact: true,
    });
  const drawer = () =>
    page.getByRole("dialog", { name: "Workspace navigation", exact: true });
  await page.goto(base + "/teams/TEAM/projects/PROJECT/tasks/7");
  await page.getByRole("button", { name: "Edit name", exact: true }).waitFor();
  let bounds = await page
    .getByRole("region", { name: "Workspace content", exact: true })
    .boundingBox();
  assert.equal(bounds.x, 0);
  assert.equal(bounds.width, 390);
  await shot("phase2j3b-task-mobile.png");
  await menu().click();
  await drawer().waitFor();
  await audit('[data-slot="dialog-content"]', "mobile-drawer");
  await shot("phase2j3b-drawer-mobile.png");
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await drawer().evaluate((el) => el.contains(document.activeElement)),
      true,
    );
  }
  await page.keyboard.press("Escape");
  await drawer().waitFor({ state: "hidden" });
  assert.equal(
    await menu().evaluate((el) => el === document.activeElement),
    true,
  );
  await menu().click();
  await page.mouse.click(385, 400);
  await drawer().waitFor({ state: "hidden" });
  await menu().click();
  await drawer().getByRole("link", { name: "Projects", exact: true }).click();
  await page.waitForURL("**/teams/TEAM/projects");
  await drawer().waitFor({ state: "hidden" });
  assert.equal(
    await menu().evaluate((el) => el === document.activeElement),
    true,
  );
  await menu().click();
  await drawer()
    .getByRole("combobox", { name: /Switch team/ })
    .click();
  await page
    .getByRole("combobox", { name: "Search teams", exact: true })
    .fill("Platform");
  await audit('[data-slot="popover-content"]', "team-switcher");
  await page.getByRole("option", { name: /Platform operations/ }).click();
  await page.waitForURL("**/teams/OTHER");
  await menu().waitFor();
  assert.equal(await drawer().count(), 0);
  await page.goto(base + "/teams/TEAM");
  await menu().click();
  await drawer()
    .getByRole("combobox", { name: /Switch team/ })
    .click();
  await page.getByRole("button", { name: "Create Team", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create Team", exact: true });
  await create.waitFor();
  await create.getByRole("button", { name: "Cancel", exact: true }).click();
  await create.waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  await drawer().waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Collapse workspace sidebar", exact: true })
    .click();
  await settle();
  for (const label of [
    "Overview",
    "Projects",
    "Members",
    "Activity",
    "Insights",
  ])
    assert.equal(
      await page
        .getByRole("navigation", { name: "Workspace", exact: true })
        .getByRole("link", { name: label, exact: true })
        .count(),
      1,
    );
  await audit('aside[aria-label="Team sidebar"]', "desktop-collapsed-sidebar");
  await shot("phase2j3b-sidebar-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await menu().click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await drawer().waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Expand workspace sidebar", exact: true })
    .waitFor();
  await page.goto(base + "/teams");
  let link = page.getByRole("link", { name: /Customer delivery/ });
  await link.waitFor();
  assert.equal(await link.getAttribute("href"), "/teams/TEAM");
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/teams/TEAM");
  await page.goto(base + "/teams");
  await page.getByRole("tab", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Sort by Name", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("columnheader", { name: "Sort by Name", exact: true })
    .filter({ has: page.locator("button") })
    .waitFor();
  assert.equal(
    await page
      .getByRole("columnheader", { name: "Sort by Name", exact: true })
      .getAttribute("aria-sort"),
    "descending",
  );
  await page.keyboard.press("Space");
  assert.equal(
    await page
      .getByRole("columnheader", { name: "Sort by Name", exact: true })
      .getAttribute("aria-sort"),
    "ascending",
  );
  await page
    .getByRole("link", { name: "Customer delivery", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/teams/TEAM");
  await page.goto(base + "/teams/TEAM/projects");
  link = page.getByRole("link", { name: /Customer portal/ });
  await link.waitFor();
  assert.equal(await link.getAttribute("href"), "/teams/TEAM/projects/PROJECT");
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/teams/TEAM/projects/PROJECT");
  const openTask = () =>
      page.getByRole("button", {
        name: "Open task #7: Review delivery plan",
        exact: true,
      }),
    handle = () =>
      page.getByRole("button", {
        name: "Move task #7: Review delivery plan",
        exact: true,
      });
  await openTask().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Task #7", exact: true }).waitFor();
  assert.equal(writes.length, 0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Task #7", exact: true })
    .waitFor({ state: "hidden" });
  await settle();
  await handle().focus();
  await page.keyboard.press("Space");
  assert.equal(await handle().getAttribute("aria-pressed"), "true");
  await settle();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() =>
    document
      .querySelector("[role=status]")
      ?.textContent?.includes("IN_PROGRESS"),
  );
  await page.keyboard.press("Space");

  await page
    .locator('[data-board-status="IN_PROGRESS"]')
    .getByRole("button", {
      name: "Move task #7: Review delivery plan",
      exact: true,
    })
    .waitFor();
  await settle();
  assert.deepEqual(writes, [{ status: "IN_PROGRESS" }]);

  assert.equal(
    await handle().evaluate((el) => el === document.activeElement),
    true,
    "Keyboard drag must restore focus after the confirmed task moves columns",
  );
  const dragRect = await handle().boundingBox(),
    dropRect = await page
      .locator('[data-board-status="IN_REVIEW"]')
      .boundingBox();
  await page.mouse.move(
    dragRect.x + dragRect.width / 2,
    dragRect.y + dragRect.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    dragRect.x + dragRect.width / 2 + 10,
    dragRect.y + dragRect.height / 2,
    { steps: 3 },
  );
  await page.mouse.move(dropRect.x + dropRect.width / 2, dropRect.y + 100, {
    steps: 14,
  });
  await page.mouse.up();
  await page
    .locator('[data-board-status="IN_REVIEW"]')
    .getByRole("button", {
      name: "Move task #7: Review delivery plan",
      exact: true,
    })
    .waitFor();
  assert.deepEqual(writes, [
    { status: "IN_PROGRESS" },
    { status: "IN_REVIEW" },
  ]);
  await page.getByRole("tab", { name: "List", exact: true }).click();
  link = page.getByRole("link", { name: "Review delivery plan", exact: true });
  await link.waitFor();
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/tasks/7");
  await page.setViewportSize({ width: 390, height: 500 });
  await menu().click();
  await drawer().waitFor();
  bounds = await drawer().boundingBox();
  assert.ok(bounds.y >= 0 && bounds.height <= 500);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await audit('[data-slot="dialog-content"]', "short-dark-drawer");
  await shot("phase2j3b-drawer-dark-mobile.png");
  await page.keyboard.press("Escape");
  holdTeam = true;
  await page.goto(base + "/teams/TEAM");
  await page
    .getByRole("status")
    .filter({ hasText: "Loading workspace..." })
    .waitFor();
  const loadingBounds = await page
    .getByRole("region", { name: "Workspace content", exact: true })
    .boundingBox();
  assert.equal(loadingBounds.x, 0);
  assert.equal(loadingBounds.width, 390);
  await shot("phase2j3b-workspace-loading-mobile.png");
  releaseTeam();
  holdTeam = false;
  await menu().waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      mobileContentWidth: 390,
      drawerFocusTrap: true,
      escapeBackdropAndRouteClose: true,
      triggerFocusRestored: true,
      teamSearchAndSwitch: true,
      nestedCreateDialog: true,
      desktopCollapsePreserved: true,
      nativeCardAndRowLinks: true,
      keyboardSorting: true,
      taskOpenSeparateFromDrag: true,
      keyboardAndPointerMoves: 2,
      scans,
      pageErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}

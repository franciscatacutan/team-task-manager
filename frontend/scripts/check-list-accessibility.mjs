// Start Vite on 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-list-accessibility.mjs <temporary Playwright + axe installation>
// All APIs are synthetic. No real development data or permissions are changed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
if (!process.argv[2])
  throw new Error("Pass the temporary browser-test installation directory.");
const require = createRequire(resolve(process.argv[2], "package.json"));
const { chromium } = require("playwright"),
  { default: AxeBuilder } = require("@axe-core/playwright");
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
    writes = [],
    scans = [],
    layouts = [],
    failures = [];
  const date = "2026-11-05T00:00:00Z";
  const viewer = {
    id: "owner",
    userId: "owner",
    firstName: "Browser",
    lastName: "Owner",
    email: "owner@example.test",
    role: "ADMIN",
    createdAt: date,
  };
  const peer = {
    id: "peer",
    firstName: "Taylor",
    lastName: "Member",
    email: "peer@example.test",
    role: "USER",
    createdAt: date,
  };
  const users = [
    viewer,
    peer,
    ...Array.from({ length: 38 }, (_, i) => ({
      ...peer,
      id: `user-${i}`,
      firstName: `Person ${i}`,
      email: `person${i}@example.test`,
    })),
  ];
  const teams = Array.from({ length: 40 }, (_, i) => ({
    key: i ? `TEAM${i}` : "TEAM",
    name: `Customer delivery ${i + 1}`,
    description: "A realistic description for keyboard and layout checks.",
    owner: viewer,
    createdBy: viewer,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
    deletedAt: null,
  }));
  const team = teams[0];
  const projects = Array.from({ length: 40 }, (_, i) => ({
    key: i ? `PROJECT${i}` : "PROJECT",
    teamKey: team.key,
    name: `Customer portal ${i + 1}`,
    description: "Prepare the customer portal.",
    status: "ACTIVE",
    owner: viewer,
    createdBy: viewer,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
    deletedAt: null,
  }));
  const project = projects[0];
  const tasks = Array.from({ length: 40 }, (_, i) => ({
    taskNumber: i + 1,
    name: `Delivery task ${i + 1}`,
    description: "Review implementation and accessibility.",
    type: "TASK",
    status: "TODO",
    priority: "LOW",
    assignedUser: peer,
    supportUser: viewer,
    createdBy: viewer,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
    deletedAt: null,
  }));
  const members = users.map((user, index) => ({
    ...user,
    globalRole: user.role,
    teamRole: index ? "MEMBER" : "OWNER",
    joinedAt: date,
  }));
  const activity = {
    id: "activity",
    message: "A useful teammate comment for history.",
    type: "TASK_COMMENTED",
    details: {},
    user: peer,
    project: { key: project.key, name: project.name },
    task: { taskNumber: 7, name: tasks[6].name },
    teamKey: team.key,
    projectKey: project.key,
    taskNumber: 7,
    targetPath: "/teams/TEAM/projects/PROJECT/tasks/7",
    createdAt: date,
  };
  const notification = {
    id: "notice",
    type: "TASK",
    eventType: "TASK_COMMENTED",
    title: "A teammate commented",
    body: "Please review the delivery task before the next team meeting.",
    targetPath: activity.targetPath,
    teamKey: team.key,
    projectKey: project.key,
    taskNumber: "7",
    actor: peer,
    read: false,
    readAt: null,
    createdAt: date,
  };
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: viewer.email, userId: viewer.id, role: viewer.role, exp: Math.floor(Date.now() / 1000) + 3600 })}.mock`;
  const context = await browser.newContext();
  let fitMode = false;
  const fullAccessibility = process.env.TTM_TEST_FULL_ACCESSIBILITY === "1";
  const memberRequests = [];
  const paged = (rows, url) => {
    if (fitMode) rows = rows.slice(0, 1);
    const size = Math.max(1, Number(url.searchParams.get("size") ?? 10)),
      page = Number(url.searchParams.get("page") ?? 0);
    return {
      content: rows.slice(page * size, (page + 1) * size),
      page,
      size,
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / size),
      first: page === 0,
      last: (page + 1) * size >= rows.length,
    };
  };
  await context.route(`${base}/api/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path === "/api/auth/refresh")
      return route.fulfill({
        json: { token, user: viewer, expiresInSeconds: 3600 },
      });
    if (req.method() !== "GET") {
      writes.push({ method: req.method(), path });
      return route.fulfill({
        status: 500,
        json: { message: "Unexpected write" },
      });
    }
    if (path === "/api/users/me") return route.fulfill({ json: viewer });
    if (path === "/api/users")
      return route.fulfill({ json: paged(users, url) });
    if (path === "/api/users/owner") return route.fulfill({ json: viewer });
    if (path === "/api/users/peer") return route.fulfill({ json: peer });
    if (path === "/api/teams")
      return route.fulfill({ json: paged(teams, url) });
    if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
    if (path === "/api/teams/TEAM/me")
      return route.fulfill({ json: { userId: viewer.id, role: "OWNER" } });
    if (path.endsWith("/members")) {
      memberRequests.push(Number(url.searchParams.get("size") ?? 10));
      return route.fulfill({ json: paged(members, url) });
    }
    if (path.endsWith("/projects"))
      return route.fulfill({ json: paged(projects, url) });
    if (path === "/api/teams/TEAM/projects/PROJECT")
      return route.fulfill({ json: project });
    if (path.endsWith("/tasks/7")) return route.fulfill({ json: tasks[6] });
    if (path.endsWith("/tasks"))
      return route.fulfill({
        json: paged(
          tasks.filter(
            (task) =>
              !url.searchParams.getAll("status").length ||
              url.searchParams.getAll("status").includes(task.status),
          ),
          url,
        ),
      });
    if (path.endsWith("/activities"))
      return route.fulfill({ json: paged([activity], url) });
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 1 } });
    if (path === "/api/notifications")
      return route.fulfill({ json: paged([notification], url) });
    if (path.endsWith("/insights/summary"))
      return route.fulfill({ json: null });
    return route.fulfill({ json: paged([], url) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  async function settle() {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      );
    });
  }
  async function goto(path, dark) {
    await page.goto(base + path);
    await page.evaluate(
      (value) => document.documentElement.classList.toggle("dark", value),
      dark,
    );
  }
  async function contrast(name) {
    await settle();
    const builder = new AxeBuilder({ page });
    const result = await (
      fullAccessibility
        ? builder.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        : builder.withRules(["color-contrast"])
    ).analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
    scans.push({ state: name, viewport: page.viewportSize(), violations });
    if (violations.length)
      failures.push(
        `${name}: ${violations.length} accessibility rule failures`,
      );
  }
  async function shot(name) {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(process.env.TTM_TEST_SCREENSHOTS, `${name}.png`),
      });
  }
  const surfaces = [
    {
      name: "teams",
      path: "/teams",
      label: "Teams table",
      search: "Search teams",
      tab: true,
    },
    {
      name: "projects",
      path: "/teams/TEAM/projects",
      label: "Projects table",
      search: "Search projects",
      tab: true,
    },
    {
      name: "tasks",
      path: "/teams/TEAM/projects/PROJECT",
      label: "Tasks table",
      search: "Search tasks",
      tab: true,
    },
    {
      name: "users",
      path: "/users",
      label: "Users table",
      search: "Search users",
    },
    {
      name: "members",
      path: "/teams/TEAM/members",
      label: "Team members table",
      search: "Search members",
    },
  ];
  for (const viewport of [
    { width: 1440, height: 800, dark: false },
    { width: 390, height: 844, dark: false },
    { width: 320, height: 320, dark: false },
    { width: 1280, height: 600, dark: true },
  ]) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    for (const surface of surfaces) {
      const name = `${surface.name}-${viewport.width}-${viewport.height}-${viewport.dark ? "dark" : "light"}`;
      console.log(`Checking ${name}`);
      await goto(surface.path, viewport.dark);
      await page
        .getByRole("textbox", { name: surface.search, exact: true })
        .waitFor();
      if (surface.tab)
        await page.getByRole("tab", { name: "List", exact: true }).click();
      const table = page.locator('[data-slot="table"]');
      await table.locator("tbody tr").last().waitFor();
      const container = table.locator("..");
      await container.evaluate((el) => (el.id = "current-table-probe"));
      await settle();
      const layout = await container.evaluate((el) => ({
        width: el.clientWidth,
        height: el.clientHeight,
        contentWidth: el.scrollWidth,
        contentHeight: el.scrollHeight,
        tabIndex: el.getAttribute("tabindex"),
        label: el.getAttribute("aria-label"),
        pageWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      const horizontal = layout.contentWidth > layout.width + 1,
        vertical = layout.contentHeight > layout.height + 1;
      const small = viewport.width < 768 || viewport.height < 768;
      if (layout.height < 20) failures.push(`${name}: collapsed table`);
      if (layout.pageWidth > layout.viewport + 1)
        failures.push(`${name}: page overflow`);
      if (small && vertical)
        failures.push(
          `${name}: table still scrolls vertically on a small screen`,
        );
      if (
        horizontal || vertical
          ? layout.tabIndex !== "0" || layout.label !== surface.label
          : layout.tabIndex !== null
      )
        failures.push(`${name}: incorrect scroll focus/name`);
      if (horizontal || vertical) {
        await container.focus();
        const property = horizontal ? "scrollLeft" : "scrollTop";
        const previous = await container.evaluate(
          (el, property) => el[property],
          property,
        );
        await page.keyboard.press(horizontal ? "ArrowRight" : "ArrowDown");
        await page.waitForFunction(
          ({ property, previous }) =>
            document.getElementById("current-table-probe")[property] > previous,
          { property, previous },
        );
      }
      if (small) {
        const lastLink = table
          .locator("tbody tr")
          .last()
          .getByRole("link")
          .first();
        await lastLink.scrollIntoViewIfNeeded();
        await lastLink.click({ trial: true });
      }
      layouts.push({ state: name, small, horizontal, vertical, ...layout });
      await contrast(name);
      if (viewport.height === 320 || viewport.width === 1440) await shot(name);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto("/teams/TEAM/members", false);
  await page.locator('[data-slot="table"] tbody tr').last().waitFor();
  const rowsControl = page.getByRole("combobox", {
    name: "Rows per page",
    exact: true,
  });
  await rowsControl.focus();
  await page.keyboard.press("ArrowDown");
  await page.getByRole("option", { name: "20", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-slot="table"] tbody tr').length === 20,
  );
  const selectedRows = await rowsControl.textContent();
  const renderedRows = await page
    .locator('[data-slot="table"] tbody tr')
    .count();
  assert.equal(selectedRows, "20");
  assert.equal(renderedRows, 20);
  assert.equal(memberRequests.at(-1), 20);
  layouts.push({
    state: "member-page-size-confirmed",
    selected: selectedRows,
    renderedRows,
    requestedSize: memberRequests.at(-1),
  });
  // A real fitting table must not add a redundant keyboard stop.
  fitMode = true;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto("/teams", false);
  await page.getByRole("tab", { name: "List", exact: true }).click();
  const fitTable = page.locator('[data-slot="table"]');
  await fitTable.locator("tbody tr").waitFor();
  await settle();
  const fitLayout = await fitTable.locator("..").evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
    contentWidth: el.scrollWidth,
    contentHeight: el.scrollHeight,
    tabIndex: el.getAttribute("tabindex"),
    label: el.getAttribute("aria-label"),
  }));
  assert(
    fitLayout.contentWidth <= fitLayout.width + 1 &&
      fitLayout.contentHeight <= fitLayout.height + 1,
  );
  assert.equal(fitLayout.tabIndex, null);
  assert.equal(fitLayout.label, null);
  layouts.push({ state: "teams-fitting-table-no-extra-stop", ...fitLayout });
  fitMode = false;
  for (const dark of [false, true]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const suffix = dark ? "dark" : "light";
    for (const surface of [
      { name: "overview", path: "/teams/TEAM", text: team.name },
      {
        name: "activity",
        path: "/teams/TEAM/activity",
        text: activity.message,
      },
      { name: "profile", path: "/users/peer", text: peer.email },
      {
        name: "task-history",
        path: "/teams/TEAM/projects/PROJECT/tasks/7",
        text: "History",
      },
      {
        name: "users-contrast",
        path: "/users",
        text: "Manage people and access",
      },
      {
        name: "members-contrast",
        path: "/teams/TEAM/members",
        text: "Members",
      },
    ]) {
      const name = `${surface.name}-${suffix}`;
      console.log(`Checking ${name}`);
      await goto(surface.path, dark);
      await page.getByText(surface.text, { exact: true }).first().waitFor();
      if (surface.name === "overview")
        await page.getByText(peer.email, { exact: true }).first().waitFor();
      if (surface.name === "profile")
        await page
          .getByRole("heading", { name: "Taylor Member", exact: true })
          .waitFor();
      if (surface.name === "task-history")
        await page
          .getByText(activity.message, { exact: true })
          .first()
          .waitFor();
      await contrast(name);
      await shot(name);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await goto("/teams/TEAM", dark);
    await page
      .getByRole("button", { name: "1 unread notifications", exact: true })
      .click();
    await page.getByText(notification.body, { exact: true }).waitFor();
    await contrast(`notifications-${suffix}`);
    await shot(`notifications-${suffix}`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      ruleScope: fullAccessibility
        ? "WCAG 2 A/AA + 2.1 AA"
        : "color-contrast only",
      layouts,
      scans,
      failures,
      pageErrors: errors,
      mutations: writes.length,
    }),
  );
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}

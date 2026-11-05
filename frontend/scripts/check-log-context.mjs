// Start Vite on 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-log-context.mjs <temporary Playwright + axe installation>
// All API traffic is mocked; no real data is modified.
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
    writes = [],
    scans = [],
    layouts = [];
  const date = "2026-11-05T00:00:00Z";
  const ids = {
    teamId: "11000000-0000-4000-8000-000000000001",
    projectId: "22000000-0000-4000-8000-000000000002",
    taskId: "33000000-0000-4000-8000-000000000003",
  };
  const viewer = {
    id: "44000000-0000-4000-8000-000000000004",
    userId: "44000000-0000-4000-8000-000000000004",
    firstName: "Browser",
    lastName: "Admin",
    email: "browser@example.test",
    role: "ADMIN",
  };
  const team = {
    id: ids.teamId,
    key: "TEAM",
    name: "Customer delivery",
    description: "Coordinate the launch.",
    owner: viewer,
    createdBy: viewer,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
    deletedAt: null,
  };
  const project = {
    id: ids.projectId,
    key: "PROJECT",
    teamKey: team.key,
    name: "Customer portal",
    description: "Prepare delivery.",
    status: "ACTIVE",
    owner: viewer,
    createdBy: viewer,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
    deletedAt: null,
  };
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: viewer.email, userId: viewer.id, role: viewer.role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock`;
  const paged = (content, page = 0, totalPages = content.length ? 1 : 0) => ({
    content,
    page,
    size: 10,
    totalElements: totalPages * content.length,
    totalPages,
    last: page + 1 >= totalPages,
  });
  const audit = {
    id: "55000000-0000-4000-8000-000000000005",
    ...ids,
    entityType: "TASK",
    entityId: ids.taskId,
    action: "UPDATE",
    eventType: "TASK_UPDATED",
    actor: viewer,
    summary: "Audit context loaded",
    metadata: null,
    occurredAt: date,
  };
  const system = {
    id: "66000000-0000-4000-8000-000000000006",
    ...ids,
    severity: "INFO",
    category: "TASK",
    eventName: "TASK_UPDATED",
    source: "TaskService",
    actor: null,
    message: "System context loaded",
    context: null,
    occurredAt: date,
  };
  const tasks = {
    total: 20,
    todo: 6,
    inProgress: 4,
    inReview: 2,
    onHold: 1,
    done: 6,
    cancelled: 1,
    overdue: 1,
    highPriority: 2,
    criticalPriority: 1,
  };
  const flow = {
    completedLast7Days: 3,
    completionRatePercent: 30,
    averageCycleTimeHours: 24.5,
  };
  const activity = {
    activityEventsLast7Days: 5,
    auditEventsLast7Days: 4,
    systemEventsLast7Days: 2,
  };
  const projectSummary = {
    teamId: ids.teamId,
    projectId: ids.projectId,
    generatedAt: date,
    status: "ACTIVE",
    plannedStartDate: date,
    plannedDueDate: "2026-12-01T00:00:00Z",
    actualStartDate: null,
    actualCompletionDate: null,
    tasks,
    flow,
    activity,
    health: { overdue: false, daysUntilDue: 26, completedOnTime: false },
  };
  const teamSummary = {
    teamId: ids.teamId,
    generatedAt: date,
    tasks,
    flow,
    activity,
    membership: { total: 5, owners: 1, admins: 1, members: 3 },
    projects: {
      total: 5,
      active: 3,
      onHold: 1,
      completed: 1,
      completedLast7Days: 1,
      completionRatePercent: 20,
    },
    health: {
      openTasks: 13,
      overdueTasks: 1,
      openTasksPerMember: 2.6,
      activeProjectsPerMember: 0.6,
    },
  };
  for (const config of [
    { scope: "team", width: 390, height: 844, dark: false },
    { scope: "team", width: 1440, height: 1000, dark: true },
    { scope: "project", width: 320, height: 568, dark: true },
    { scope: "project", width: 1440, height: 1000, dark: false },
  ]) {
    const name = `${config.scope}-${config.width}-${config.dark ? "dark" : "light"}`;
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height },
    });
    const requests = [];
    let summaryUnavailable = false;
    await context.route(`${base}/api/**`, async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname;
      if (path === "/api/auth/refresh")
        return route.fulfill({
          json: { token, user: viewer, expiresInSeconds: 900 },
        });
      if (req.method() !== "GET") {
        writes.push({ method: req.method(), path });
        return route.fulfill({
          status: 500,
          json: { message: "Unexpected write" },
        });
      }
      if (
        path.endsWith("/insights/audit-logs") ||
        path.endsWith("/insights/system-events")
      ) {
        requests.push({
          path,
          page: url.searchParams.get("page"),
          sort: url.searchParams.get("sort"),
        });
        const page = Number(url.searchParams.get("page") ?? 0);
        const row = path.endsWith("audit-logs") ? audit : system;
        return route.fulfill({
          json: paged(
            [
              {
                ...row,
                ...(page
                  ? { teamId: null, projectId: null, taskId: null }
                  : {}),
              },
            ],
            page,
            2,
          ),
        });
      }
      if (path === "/api/users/me") return route.fulfill({ json: viewer });
      if (path === "/api/teams") return route.fulfill({ json: paged([team]) });
      if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
      if (path.endsWith("/me"))
        return route.fulfill({ json: { userId: viewer.id, role: "OWNER" } });
      if (path === "/api/teams/TEAM/projects/PROJECT")
        return route.fulfill({ json: project });
      if (path.endsWith("/projects"))
        return route.fulfill({ json: paged([project]) });
      if (path.endsWith("/insights/summary"))
        return route.fulfill(
          summaryUnavailable
            ? { status: 500, json: { message: "Summary unavailable" } }
            : { json: config.scope === "team" ? teamSummary : projectSummary },
        );
      if (path === "/api/notifications/unread-count")
        return route.fulfill({ json: { unreadCount: 0 } });
      return route.fulfill({ json: paged([]) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      base +
        (config.scope === "team"
          ? "/teams/TEAM/insights"
          : "/teams/TEAM/projects/PROJECT?view=insights"),
    );
    if (config.scope === "project")
      await page.getByRole("tab", { name: "Insights", exact: true }).click();
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      config.dark,
    );
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Operational Logs", { exact: true }) });
    await card.getByText("Audit context loaded", { exact: true }).waitFor();
    await page
      .getByText(config.scope === "team" ? "Task completion" : "Completion", {
        exact: true,
      })
      .first()
      .waitFor();
    const summaryScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const summaryViolations = summaryScan.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }));
    scans.push({
      state: `${name}-populated-insights`,
      scope: "populated page",
      violations: summaryViolations,
    });
    assert.deepEqual(summaryViolations, []);

    if (config.scope === "project" && config.width === 320) {
      const tablist = page.getByRole("tablist").filter({
        has: page.getByRole("tab", { name: "Insights", exact: true }),
      });
      await page.getByRole("tab", { name: "Board", exact: true }).focus();
      for (const label of ["List", "Activity", "Insights"]) {
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(
          (label) =>
            [...document.querySelectorAll('[role="tab"]')].some(
              (tab) =>
                tab.textContent.trim() === label &&
                tab.getAttribute("data-state") === "active",
            ),
          label,
        );
        const tab = page.getByRole("tab", { name: label, exact: true });
        assert.equal(await tab.getAttribute("data-state"), "active");
        const bounds = await tab.boundingBox();
        assert(
          bounds &&
            bounds.x >= 0 &&
            bounds.x + bounds.width <= config.width + 1,
          `Tab ${label} does not fit`,
        );
      }
      await card.getByText("Audit context loaded", { exact: true }).waitFor();
      const layout = await tablist.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          tabs: [...el.querySelectorAll('[role="tab"]')].map((tab) => {
            const r = tab.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          }),
          contentScrollLeft: document.querySelector(
            '[aria-label="Workspace content"]',
          ).scrollLeft,
        };
      });
      const cardBounds = await card.boundingBox();
      assert.equal(layout.contentScrollLeft, 0);
      assert(
        cardBounds &&
          cardBounds.x >= 0 &&
          cardBounds.x + cardBounds.width <= config.width + 1,
      );
      for (const bounds of layout.tabs)
        assert(
          bounds.left >= layout.left - 1 &&
            bounds.right <= layout.right + 1 &&
            bounds.top >= layout.top - 1 &&
            bounds.bottom <= layout.bottom + 1,
        );
      layouts.push({
        state: "project-tabs-fit-with-keyboard-navigation",
        ...layout,
        cardBounds,
      });
    }
    for (const stream of ["audit", "system"]) {
      if (stream === "system")
        await card
          .getByRole("tab", { name: "System Events", exact: true })
          .click();
      await card
        .getByText(
          stream === "audit" ? "Audit context loaded" : "System context loaded",
          { exact: true },
        )
        .waitFor();
      await card.getByText("Updated", { exact: true }).waitFor();
      assert.equal(await card.getByText("Comment", { exact: true }).count(), 0);
      for (const [label, id] of [
        ["Team", ids.teamId],
        ["Project", ids.projectId],
        ["Task", ids.taskId],
      ])
        await card.getByText(`${label} ID: ${id}`, { exact: true }).waitFor();
      assert.equal(await card.getByRole("link").count(), 0);
      const metadata = card
        .getByText(`Team ID: ${ids.teamId}`, { exact: true })
        .locator("..")
        .locator("..");
      await metadata.scrollIntoViewIfNeeded();
      await page.evaluate(async () => {
        await new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        );
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (a) => a.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((a) => a.finished.catch(() => {})),
        );
      });
      const bounds = await metadata.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          viewport: window.innerWidth,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          items: [...el.querySelectorAll("span > span")]
            .filter((item) => item.textContent.includes(" ID:"))
            .map((item) => {
              const r = item.getBoundingClientRect();
              return {
                left: r.left,
                right: r.right,
                scrollWidth: item.scrollWidth,
                clientWidth: item.clientWidth,
              };
            }),
        };
      });
      assert(
        bounds.left >= 0 && bounds.right <= bounds.viewport + 1,
        `${name} ${stream}: metadata extends outside viewport`,
      );
      assert(
        bounds.scrollWidth <= bounds.clientWidth + 1,
        `${name} ${stream}: overflowing metadata`,
      );
      assert.equal(bounds.items.length, 3);
      for (const item of bounds.items)
        assert(
          item.scrollWidth <= item.clientWidth + 1 &&
            item.right <= bounds.viewport + 1,
          `${name} ${stream}: clipped UUID`,
        );
      layouts.push({ state: `${name}-${stream}`, ...bounds });
      await metadata.evaluate((el) => (el.id = "log-context-probe"));
      const result = await new AxeBuilder({ page })
        .include("#log-context-probe")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const violations = result.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((n) => n.target),
      }));
      scans.push({
        state: `${name}-${stream}`,
        scope: "log UUID metadata",
        violations,
      });
      assert.deepEqual(violations, [], `${name} ${stream}`);
      await metadata.evaluate((el) => el.removeAttribute("id"));
      if (process.env.TTM_TEST_SCREENSHOTS)
        await page.screenshot({
          path: resolve(
            process.env.TTM_TEST_SCREENSHOTS,
            `${name}-${stream}.png`,
          ),
        });
      await card.getByRole("button", { name: "Next", exact: true }).click();
      await card.getByText("Page 2 of 2", { exact: true }).waitFor();
      assert.equal(await card.getByText(/^(Team|Project|Task) ID:/).count(), 0);
    }
    await card.getByRole("combobox", { name: "Sort operational logs" }).focus();
    await page.keyboard.press("ArrowDown");
    await page
      .getByRole("option", { name: "Oldest first", exact: true })
      .click();
    await card.getByText("Page 1 of 2", { exact: true }).waitFor();
    await card.getByText(`Task ID: ${ids.taskId}`, { exact: true }).waitFor();
    await card.getByRole("tab", { name: "Audit Logs", exact: true }).click();
    await card.getByText("Page 1 of 2", { exact: true }).waitFor();
    assert(
      requests.some(
        (r) =>
          r.path.endsWith("audit-logs") &&
          r.page === "0" &&
          r.sort === "occurredAt,asc",
      ),
    );
    assert(
      requests.some(
        (r) =>
          r.path.endsWith("system-events") &&
          r.page === "0" &&
          r.sort === "occurredAt,asc",
      ),
    );
    summaryUnavailable = true;
    await page.reload();
    if (config.scope === "project")
      await page.getByRole("tab", { name: "Insights", exact: true }).click();
    const summaryFailure = page
      .getByRole("alert")
      .filter({ hasText: "Unable to load insights." });
    await summaryFailure.waitFor();
    await card.getByText("Audit context loaded", { exact: true }).waitFor();
    summaryUnavailable = false;
    await summaryFailure
      .getByRole("button", { name: "Retry", exact: true })
      .click();
    await page
      .getByText(config.scope === "team" ? "Task completion" : "Completion", {
        exact: true,
      })
      .first()
      .waitFor();
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      fullUuidContext: true,
      structuredEventLabels: true,
      populatedSummariesAndIndependentRetry: true,
      narrowProjectTabsFit: true,
      missingContextOmitted: true,
      noInventedLinks: true,
      pagingAndSortPreserved: true,
      layouts,
      scans,
      mutations: writes.length,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

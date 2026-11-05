// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-comment-log-feedback.mjs <temporary Playwright + @axe-core/playwright installation>
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
  let auditFail = true,
    systemFail = false,
    auditAttempts = 0,
    systemAttempts = 0,
    releaseComment,
    commentArrived;
  const auditRow = {
    id: "audit",
    teamId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    taskId: null,
    entityType: "TEAM",
    entityId: "00000000-0000-4000-8000-000000000001",
    action: "UPDATE",
    eventType: "TEAM_UPDATED",
    summary: "Audit record loaded",
    actor: user,
    metadata: null,
    occurredAt: date,
  };
  const systemRow = {
    id: "system",
    teamId: auditRow.teamId,
    projectId: auditRow.projectId,
    taskId: null,
    severity: "INFO",
    category: "TEAM",
    eventName: "TEAM_UPDATED",
    source: "TeamService",
    message: "System record loaded",
    actor: user,
    context: null,
    occurredAt: date,
  };
  const task = {
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
    if (path.endsWith("/tasks/7/activities") && request.method() === "POST") {
      writes.push(request.postDataJSON());
      const result = await new Promise((resolve) => {
        releaseComment = resolve;
        commentArrived();
      });
      return route.fulfill(result);
    }
    if (path.endsWith("/insights/audit-logs")) {
      auditAttempts++;
      return route.fulfill(
        auditFail
          ? { status: 500, json: { message: "Audit service unavailable" } }
          : { json: paged([auditRow]) },
      );
    }
    if (path.endsWith("/insights/system-events")) {
      systemAttempts++;
      return route.fulfill(
        systemFail
          ? { status: 500, json: { message: "System service unavailable" } }
          : { json: paged([systemRow]) },
      );
    }
    if (path === "/api/auth/refresh")
      return route.fulfill({ json: { token, user, expiresInSeconds: 900 } });
    if (path === "/api/users/me") return route.fulfill({ json: user });
    if (path === "/api/teams")
      return route.fulfill({ json: paged([team, other]) });
    if (/^\/api\/teams\/(TEAM|OTHER)$/.test(path))
      return route.fulfill({ json: path.endsWith("OTHER") ? other : team });
    if (path.endsWith("/me"))
      return route.fulfill({ json: { userId: user.id, role: "OWNER" } });
    if (path.endsWith("/projects"))
      return route.fulfill({ json: paged([project]) });
    if (path === "/api/teams/TEAM/projects/PROJECT")
      return route.fulfill({ json: project });
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
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  const shot = async (name) => {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(process.env.TTM_TEST_SCREENSHOTS, name),
      });
  };
  async function scan(locator, name) {
    await locator.evaluate((el) => {
      el.id = "feedback-scan";
    });
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
    const result = await new AxeBuilder({ page })
      .include("#feedback-scan")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    }));
    scans.push({
      name,
      violations,
    });
    assert.deepEqual(violations, [], name);
    await locator.evaluate((el) => el.removeAttribute("id"));
  }
  async function waitForComment(action) {
    let timer;
    const arrival = new Promise((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error("Comment request did not arrive")),
        10000,
      );
      commentArrived = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    try {
      await Promise.all([arrival, action()]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function commentFlow(container, prefix) {
    const field = container.getByRole("textbox", {
      name: "Comment",
      exact: true,
    });
    await field.fill(`Retain the ${prefix} draft`);
    await waitForComment(() =>
      container.getByRole("button", { name: "Post", exact: true }).click(),
    );
    assert.equal(await field.isDisabled(), true);
    assert.equal(
      await container
        .getByRole("button", { name: "Cancel", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await container
        .getByRole("button", { name: "Posting...", exact: true })
        .isDisabled(),
      true,
    );
    const section = field.locator("xpath=../..");
    await field.scrollIntoViewIfNeeded();
    await shot(`${prefix}-posting.png`);
    releaseComment({
      status: 500,
      json: { message: "The comment service is temporarily unavailable." },
    });
    await container
      .getByRole("alert")
      .filter({ hasText: "The comment service" })
      .waitFor();
    assert.equal(await field.inputValue(), `Retain the ${prefix} draft`);
    assert.equal(await field.isEnabled(), true);
    await scan(section, `${prefix}-comment-error`);
    await shot(`${prefix}-comment-error.png`);
    await waitForComment(() =>
      container
        .getByRole("button", { name: "Retry comment", exact: true })
        .click(),
    );
    releaseComment({
      json: {
        id: `comment-${writes.length}`,
        message: `Retain the ${prefix} draft`,
        actor: user,
        type: "COMMENT",
        createdAt: date,
      },
    });
    await container
      .getByRole("status")
      .filter({ hasText: "Comment posted." })
      .waitFor();
    assert.equal(await field.inputValue(), "");
    await scan(section, `${prefix}-comment-success`);
    assert.deepEqual(writes.slice(-2), [
      { message: `Retain the ${prefix} draft` },
      { message: `Retain the ${prefix} draft` },
    ]);
  }
  await page.goto(base + "/teams/TEAM/projects/PROJECT/tasks/7");
  await commentFlow(page, "mobile-page");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/teams/TEAM/projects/PROJECT");
  await page
    .getByRole("button", {
      name: "Open task #7: Review delivery plan",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Task #7", exact: true });
  await commentFlow(dialog, "desktop-dialog");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });

  async function logFlow(scope) {
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Operational Logs", { exact: true }) });
    if (scope === "team") {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + "/teams/TEAM/insights");
    } else {
      auditFail = true;
      systemFail = false;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(base + "/teams/TEAM/projects/PROJECT?view=insights");
      await page.getByRole("tab", { name: "Insights", exact: true }).click();
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    }
    await card
      .getByRole("alert")
      .filter({ hasText: "Unable to load audit logs" })
      .waitFor();
    assert.equal(
      await card.getByText("No audit logs yet", { exact: true }).count(),
      0,
    );
    await card.scrollIntoViewIfNeeded();
    await scan(card, `${scope}-audit-error`);
    await shot(`${scope}-audit-error.png`);
    const beforeSystem = systemAttempts;
    await card.getByRole("tab", { name: "System Events", exact: true }).click();
    await card.getByText("System record loaded", { exact: true }).waitFor();
    await card.getByRole("tab", { name: "Audit Logs", exact: true }).click();
    auditFail = false;
    await card.getByRole("button", { name: "Retry", exact: true }).click();
    await card.getByText("Audit record loaded", { exact: true }).waitFor();
    assert.equal(systemAttempts, beforeSystem);
    await scan(card, `${scope}-audit-recovered`);
    await card.getByRole("tab", { name: "System Events", exact: true }).click();
    await card.getByText("System record loaded", { exact: true }).waitFor();
    // A second, independent stream failure through a new sort query.
    systemFail = true;
    await card.getByRole("combobox", { name: "Sort operational logs" }).click();
    await page
      .getByRole("option", { name: "Oldest first", exact: true })
      .click();
    await card
      .getByRole("alert")
      .filter({ hasText: "Unable to load system events" })
      .waitFor();
    const beforeAudit = auditAttempts;
    await card.getByRole("tab", { name: "Audit Logs", exact: true }).click();
    await card.getByText("Audit record loaded", { exact: true }).waitFor();
    await card.getByRole("tab", { name: "System Events", exact: true }).click();
    await scan(card, `${scope}-system-error`);
    await shot(`${scope}-system-error.png`);
    systemFail = false;
    await card.getByRole("button", { name: "Retry", exact: true }).click();
    await card.getByText("System record loaded", { exact: true }).waitFor();
    assert.equal(auditAttempts, beforeAudit);
    await scan(card, `${scope}-system-recovered`);
  }
  await logFlow("team");
  await logFlow("project");
  assert.deepEqual(errors, []);
  assert.equal(writes.length, 4);
  console.log(
    JSON.stringify({
      browser: "Edge",
      commentWrites: writes.length,
      composerLocked: true,
      failedDraftRetained: true,
      pageAndDialog: true,
      independentTeamProjectRetries: true,
      mobileAndDesktop: true,
      scans,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

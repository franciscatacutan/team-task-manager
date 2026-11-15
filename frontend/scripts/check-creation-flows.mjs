// Start Vite on 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-creation-flows.mjs <temporary Playwright + @axe-core/playwright installation>
// All APIs are mocked. No development data is used.
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
  const errors = [],
    warnings = [],
    writes = [],
    a11y = [];
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000001",
    firstName: "Browser",
    lastName: "Owner",
    email: "owner@example.test",
    role: "ADMIN",
  };
  const support = {
    ...user,
    id: "00000000-0000-4000-8000-000000000002",
    firstName: "Support",
    email: "support@example.test",
  };
  const date = "2026-11-04T00:00:00Z";
  const team = {
    key: "TEAM",
    name: "Example team",
    owner: user,
    createdBy: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  const project = {
    key: "PROJECT",
    teamKey: "TEAM",
    name: "Example project",
    status: "ACTIVE",
    owner: user,
    createdBy: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: user.email, userId: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock-signature`;
  const paged = (content = []) => ({
    content,
    page: 0,
    size: 20,
    totalPages: content.length ? 1 : 0,
    totalElements: content.length,
    first: true,
    last: true,
  });
  let release, onCreate;
  const nextCreate = () =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Create request was not observed")),
        10000,
      );
      onCreate = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "en-US",
  });
  await context.route("http://127.0.0.1:4187/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      method = route.request().method();
    if (path === "/api/auth/refresh")
      return route.fulfill({ json: { token, expiresInSeconds: 900, user } });
    if (path === "/api/users/me") return route.fulfill({ json: user });
    if (
      method === "POST" &&
      [
        "/api/teams",
        "/api/teams/TEAM/projects",
        "/api/teams/TEAM/projects/PROJECT/tasks",
      ].includes(path)
    ) {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      const responseGate = new Promise((resolve) => {
        release = resolve;
      });
      onCreate?.();
      onCreate = undefined;
      const success = await responseGate;
      if (!success)
        return route.fulfill({
          status: 409,
          json: { message: "Choose another name and retry." },
        });
      return route.fulfill({
        json: {
          ...body,
          key: "NEW",
          taskNumber: 42,
          createdAt: date,
          updatedAt: date,
          lastActivityAt: date,
          status: "TODO",
          priority: body.priority ?? "LOW",
        },
      });
    }
    if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
    if (path === "/api/teams/TEAM/me")
      return route.fulfill({ json: { userId: user.id, role: "OWNER" } });
    if (path === "/api/teams/TEAM/projects/PROJECT")
      return route.fulfill({ json: project });
    if (path === "/api/teams/TEAM/members")
      return route.fulfill({ json: paged([user, support]) });
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 0 } });
    if (path === "/api/teams" || path === "/api/teams/all")
      return route.fulfill({ json: paged([team]) });
    if (path === "/api/teams/TEAM/projects")
      return route.fulfill({ json: paged([project]) });
    if (path.endsWith("/insights/summary"))
      return route.fulfill({ json: null });
    return route.fulfill({ json: paged() });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      ["warning", "error"].includes(message.type()) &&
      !message.text().includes("409")
    )
      warnings.push(message.text());
  });
  await page.clock.setFixedTime(new Date(date));
  await page.goto("http://127.0.0.1:4187/teams/TEAM/projects/PROJECT");
  async function open(entity) {
    await page
      .getByRole("button", { name: "Create", exact: true })
      .first()
      .click();
    await page
      .getByRole("menuitem", { name: `New ${entity}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: `Create ${entity}`,
      exact: true,
    });
    await dialog.waitFor();
    return dialog;
  }
  async function screenshot(entity, suffix) {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(
          process.env.TTM_TEST_SCREENSHOTS,
          `phase2j2-create-${entity.toLowerCase()}-${suffix}.png`,
        ),
      });
  }
  for (const entity of ["Team", "Project", "Task"]) {
    let dialog = await open(entity);
    const field = dialog.getByRole("textbox", { name: "Name", exact: true });
    await field.fill(`New ${entity}`);
    await dialog
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("Keep this draft after failure.");
    assert.ok(await field.getAttribute("aria-describedby"));
    if (entity === "Task") {
      await dialog
        .getByRole("combobox", { name: "Priority", exact: true })
        .click();
      await page.getByRole("option", { name: "Critical", exact: true }).click();
      await dialog
        .getByRole("combobox", { name: "Assignee", exact: true })
        .click();
      await page.getByRole("option", { name: /Browser Owner/ }).click();
      await dialog
        .getByRole("combobox", { name: "Support", exact: true })
        .click();
      const supportMenu = page.locator(
        '[data-slot="popover-content"][data-state="open"]',
      );
      await supportMenu
        .getByRole("option", { name: /Support Owner/ })
        .waitFor();
      assert.equal(
        await supportMenu
          .getByRole("option", { name: /Browser Owner/ })
          .count(),
        0,
      );
      await supportMenu.getByRole("option", { name: /Support Owner/ }).click();
      await dialog
        .getByRole("button", { name: "Planned Start", exact: true })
        .click();
      await page
        .locator(
          '[data-slot="popover-content"][data-state="open"] button[data-day="11/4/2026"]',
        )
        .click();
      // Escape dismisses the date popover, not the owning dialog.
      await page.keyboard.press("Escape");
      await dialog
        .getByRole("button", { name: "Planned Due", exact: true })
        .click();
      await page
        .locator(
          '[data-slot="popover-content"][data-state="open"] button[data-day="11/5/2026"]',
        )
        .click();
      await page.keyboard.press("Escape");
    }
    await dialog.evaluate((element) =>
      Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
    async function auditDialog(state) {
      await dialog.evaluate(async (element) => {
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        await Promise.all(
          element
            .getAnimations({ subtree: true })
            .filter(
              (animation) =>
                animation.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished.catch(() => {})),
        );
      });
      const audit = await new AxeBuilder({ page })
        .include('[data-slot="dialog-content"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const violations = audit.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map((node) => node.target),
      }));
      a11y.push({ entity, state, violations });
      assert.deepEqual(
        violations,
        [],
        `${entity}/${state} dialog accessibility`,
      );
    }
    await auditDialog("light");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await auditDialog("dark");
    await screenshot(entity, "dark-desktop");
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark"),
    );
    await screenshot(entity, "desktop");
    const before = writes.length;
    const firstArrival = nextCreate();
    await dialog
      .getByRole("button", { name: `Create ${entity}`, exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector('form[aria-busy="true"]'),
    );
    await firstArrival;
    assert.equal(await field.isDisabled(), true);
    for (const label of ["Cancel", "Close", "Creating..."])
      assert.equal(
        await dialog
          .getByRole("button", { name: label, exact: true })
          .isDisabled(),
        true,
      );
    await page.keyboard.press("Escape");
    await page.mouse.click(4, 4);
    assert.equal(await dialog.isVisible(), true);
    assert.equal(writes.length, before + 1);
    release(false);
    await dialog
      .getByRole("alert")
      .filter({ hasText: "Choose another name and retry." })
      .waitFor();
    assert.equal(await field.inputValue(), `New ${entity}`);
    assert.equal(
      await dialog
        .getByRole("textbox", { name: "Description", exact: true })
        .inputValue(),
      "Keep this draft after failure.",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );

    await auditDialog("mobile-error");
    await screenshot(entity, "mobile-error");
    if (entity === "Task") {
      const body = dialog.locator('[data-slot="creation-form-body"]');
      const headerBefore = await dialog
        .getByRole("heading", { name: "Create Task", exact: true })
        .boundingBox();
      await dialog
        .getByRole("button", { name: "Planned Due", exact: true })
        .scrollIntoViewIfNeeded();
      assert.ok(await body.evaluate((element) => element.scrollTop > 0));
      const headerAfter = await dialog
        .getByRole("heading", { name: "Create Task", exact: true })
        .boundingBox();
      assert.equal(headerAfter.y, headerBefore.y);
      const dueBounds = await dialog
        .getByRole("button", { name: "Planned Due", exact: true })
        .boundingBox();
      const submitBounds = await dialog
        .getByRole("button", { name: "Create Task", exact: true })
        .boundingBox();
      assert.ok(dueBounds.y + dueBounds.height < submitBounds.y);
      await screenshot(entity, "mobile-scrolled");
    }
    const bounds = await dialog.boundingBox();
    assert.ok(
      bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.x + bounds.width <= 391 &&
        bounds.y + bounds.height <= 845,
    );
    const actionBounds = await dialog
      .getByRole("button", { name: `Create ${entity}`, exact: true })
      .boundingBox();
    assert.ok(
      actionBounds.y >= 0 && actionBounds.y + actionBounds.height <= 844,
    );
    const retryArrival = nextCreate();
    await dialog
      .getByRole("button", { name: `Create ${entity}`, exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector('form[aria-busy="true"]'),
    );
    await retryArrival;
    assert.equal(writes.length, before + 2);
    release(true);
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(writes[before].body, writes[before + 1].body);
    if (entity === "Task")
      assert.equal(writes[before].body.priority, "CRITICAL");
    await page.setViewportSize({ width: 1440, height: 1000 });
    dialog = await open(entity);
    assert.equal(
      await dialog
        .getByRole("textbox", { name: "Name", exact: true })
        .inputValue(),
      "",
    );
    await page.mouse.click(4, 4);
    await dialog.waitFor({ state: "hidden" });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      entities: 3,
      confirmedCreates: 3,
      failedDraftRetries: 3,
      dismissalLocks: true,
      idleBackdropDismissal: true,
      dateAndMemberControls: true,
      desktopAndMobile: true,
      accessibility: a11y,
      pageErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}

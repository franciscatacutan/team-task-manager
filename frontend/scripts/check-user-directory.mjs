// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-user-directory.mjs <temporary Playwright + @axe-core/playwright installation>
// All APIs are mocked; no actual account is reset.
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
    reads = [],
    scans = [];
  const admin = {
    id: "admin",
    userId: "admin",
    firstName: "Audit",
    lastName: "Admin",
    email: "admin@example.test",
    role: "SUPER_ADMIN",
  };
  const users = [
    admin,
    ...Array.from({ length: 22 }, (_, i) => ({
      ...admin,
      id: `target-${i}`,
      firstName: i < 2 ? "Ada" : `Person${i}`,
      lastName: `Member${i}`,
      email: `person${i}@example.test`,
      role: "USER",
    })),
  ];
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: admin.email, userId: admin.id, role: admin.role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock`;
  let release, onWrite;
  function nextWrite() {
    return new Promise((done, fail) => {
      const timeout = setTimeout(
        () => fail(new Error("Reset request was not observed")),
        10000,
      );
      onWrite = () => {
        clearTimeout(timeout);
        done();
      };
    });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route(`${base}/api/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === "/api/auth/refresh")
      return route.fulfill({
        json: { token, user: admin, expiresInSeconds: 900 },
      });
    if (path === "/api/users/me") return route.fulfill({ json: admin });
    if (path === "/api/users") {
      const page = Number(url.searchParams.get("page") ?? 0),
        size = Number(url.searchParams.get("size") ?? 10),
        search = url.searchParams.get("search") ?? "";
      reads.push({ page, search });
      const rows = users.filter((u) =>
        `${u.firstName} ${u.email}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
      return route.fulfill({
        json: {
          content: rows.slice(page * size, (page + 1) * size),
          page,
          size,
          totalElements: rows.length,
          totalPages: Math.ceil(rows.length / size),
          last: (page + 1) * size >= rows.length,
        },
      });
    }
    if (
      request.method() === "PATCH" &&
      /\/admin\/users\/[^/]+\/password$/.test(path)
    ) {
      writes.push({ path, body: request.postDataJSON() });
      const gate = new Promise((done) => {
        release = done;
      });
      onWrite?.();
      onWrite = undefined;
      const success = await gate;
      return route.fulfill(
        success
          ? { status: 204 }
          : {
              status: 409,
              json: { message: "Password reset rejected. Please retry." },
            },
      );
    }
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 0 } });
    return route.fulfill({
      json: {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        last: true,
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  async function settle(dialog) {
    await dialog.evaluate(async (element) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await Promise.all(
        element
          .getAnimations({ subtree: true })
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
  async function audit(dialog, state) {
    await settle(dialog);
    const result = await new AxeBuilder({ page })
      .include('[data-slot="dialog-content"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    }));
    assert.deepEqual(violations, [], state);
    scans.push({ state, violations });
  }
  async function open(target) {
    await page
      .getByRole("row")
      .filter({ hasText: `person${target}@example.test` })
      .getByRole("button")
      .click();
    await page
      .getByRole("menuitem", { name: "Reset password", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Reset password",
      exact: true,
    });
    await dialog.waitFor();
    return dialog;
  }
  async function fill(dialog) {
    await dialog.getByLabel(/^New password/).fill("Temporary123!");
    await dialog.getByLabel(/^Confirm password/).fill("Temporary123!");
  }
  await page.goto(base + "/users");
  await page.getByText("Showing 1–10 of 23", { exact: true }).waitFor();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByText("Showing 11–20 of 23", { exact: true }).waitFor();
  const response = page.waitForResponse((r) => {
    const url = new URL(r.url());
    return (
      url.pathname === "/api/users" && url.searchParams.get("search") === "Ada"
    );
  });
  await page
    .getByRole("textbox", { name: "Search users", exact: true })
    .fill("Ada");
  await response;
  await page
    .getByRole("row")
    .filter({ hasText: "person0@example.test" })
    .waitFor();
  assert.ok(reads.some((r) => r.page === 0 && r.search === "Ada"));
  assert.equal(
    await page.getByText("No matching users", { exact: true }).count(),
    0,
  );
  for (const label of [
    "Users on this page",
    "Global admins on this page",
    "Super admins on this page",
  ])
    await page.getByText(label, { exact: true }).waitFor();
  await shot("phase2j3a-directory-search.png");
  let dialog = await open(0);
  await fill(dialog);
  let arrival = nextWrite();
  await dialog
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await arrival;
  for (const label of ["Cancel", "Close", "Resetting..."])
    assert.equal(
      await dialog
        .getByRole("button", { name: label, exact: true })
        .isDisabled(),
      true,
    );
  assert.equal(await dialog.getByLabel(/^New password/).isDisabled(), true);
  await page.keyboard.press("Escape");
  await page.mouse.click(4, 4);
  assert.equal(await dialog.isVisible(), true);
  assert.equal(writes.length, 1);
  release(false);
  await dialog
    .getByRole("alert")
    .filter({ hasText: "Password reset rejected" })
    .waitFor();
  assert.equal(
    await dialog.getByLabel(/^New password/).inputValue(),
    "Temporary123!",
  );
  await audit(dialog, "desktop-error");
  await shot("phase2j3a-reset-desktop-error.png");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  dialog = await open(1);
  assert.equal(await dialog.getByLabel(/^New password/).inputValue(), "");
  assert.equal(await dialog.getByLabel(/^Confirm password/).inputValue(), "");
  assert.equal(await dialog.getByRole("alert").count(), 0);
  await fill(dialog);
  arrival = nextWrite();
  await dialog
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await arrival;
  release(false);
  await dialog.getByRole("alert").waitFor();
  await page.setViewportSize({ width: 390, height: 500 });
  await audit(dialog, "short-mobile-error");
  const bounds = await dialog.boundingBox(),
    actionBounds = await dialog
      .getByRole("button", { name: "Reset password", exact: true })
      .boundingBox();
  assert.ok(
    bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= 391 &&
      bounds.y + bounds.height <= 501,
  );
  assert.ok(actionBounds.y >= 0 && actionBounds.y + actionBounds.height <= 500);
  await dialog.getByLabel(/^Confirm password/).scrollIntoViewIfNeeded();
  await shot("phase2j3a-reset-mobile-error.png");
  arrival = nextWrite();
  await dialog
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await arrival;
  release(true);
  await dialog.waitFor({ state: "hidden" });
  assert.equal(writes.length, 3);
  assert.equal(writes[0].path, "/api/admin/users/target-0/password");
  assert.equal(writes[1].path, "/api/admin/users/target-1/password");
  assert.deepEqual(writes[1], writes[2]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  dialog = await open(0);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await audit(dialog, "dark-clean-reopen");
  await shot("phase2j3a-reset-dark.png");
  assert.equal(await dialog.getByLabel(/^New password/).inputValue(), "");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      directorySearchResetsPage: true,
      currentPageLabels: true,
      targetDraftIsolation: true,
      pendingDismissalBlocked: true,
      sameTargetRetry: true,
      shortViewportFits: true,
      uncaughtPageErrors: errors.length,
      resetRequests: writes.length,
      scans,
    }),
  );
} finally {
  await browser.close();
}

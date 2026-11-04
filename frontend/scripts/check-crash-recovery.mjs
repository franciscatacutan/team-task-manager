// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-crash-recovery.mjs <temporary Playwright + @axe-core/playwright installation>
// Playwright alone replaces response modules to force crashes. No crash flags exist in app source.
// Every API is mocked; no real account, project or task data is changed.
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
    handled = [],
    scans = [],
    navigations = [],
    writes = [];
  let failure = "routes";
  const detail = "Forced render failure: private test diagnostic";
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route(`${base}/src/routes/AppRoutes.tsx*`, (route) =>
    failure === "routes"
      ? route.fulfill({
          contentType: "application/javascript",
          headers: { "cache-control": "no-store" },
          body: `export default function AppRoutes() { throw new Error(${JSON.stringify(detail)}); }`,
        })
      : route.continue(),
  );
  await context.route(
    `${base}/src/features/auth/context/AuthProvider.tsx*`,
    (route) =>
      failure === "provider"
        ? route.fulfill({
            contentType: "application/javascript",
            headers: { "cache-control": "no-store" },
            body: `export function AuthProvider() { throw new Error(${JSON.stringify(detail)}); }`,
          })
        : route.continue(),
  );
  const user = {
    id: "account",
    firstName: "Recovery",
    lastName: "Tester",
    email: "recovery@example.test",
    role: "USER",
  };
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: user.email, userId: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock`;
  await context.route(`${base}/api/**`, (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path === "/api/auth/refresh")
      return route.fulfill({
        json: {
          token,
          expiresInSeconds: 900,
          user: { ...user, userId: user.id },
        },
      });
    if (request.method() !== "GET")
      writes.push({ path, method: request.method() });
    if (path === "/api/users/me") return route.fulfill({ json: user });
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 0 } });
    return route.fulfill({
      json: {
        content: [],
        page: 0,
        size: 20,
        totalPages: 0,
        totalElements: 0,
        last: true,
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().startsWith("UI Crash:"))
      handled.push(message.text());
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  const heading = () =>
    page.getByRole("heading", { name: "Something went wrong", exact: true });
  const reload = () =>
    page.getByRole("button", { name: "Reload", exact: true });
  const workspace = () =>
    page.getByRole("link", { name: "Open workspace", exact: true });
  async function settle() {
    await page.evaluate(async () => {
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
  async function screenshot(name) {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(process.env.TTM_TEST_SCREENSHOTS, name),
      });
  }
  async function audit(state) {
    await settle();
    const result = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }));
    scans.push({ state, violations });
    assert.deepEqual(violations, [], state);
  }
  async function verifyRecovery() {
    await heading().waitFor();
    await settle();
    assert.equal(
      await heading().evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(await workspace().getAttribute("href"), "/teams");
    assert.equal(
      (await page.locator("body").innerText()).includes(detail),
      false,
    );
    for (const action of [reload(), workspace()]) {
      await action.scrollIntoViewIfNeeded();
      const box = await action.boundingBox(),
        view = page.viewportSize();
      assert.ok(
        box.height >= 40,
        "recovery actions need their full touch height",
      );
      assert.ok(
        box.x >= 0 &&
          box.x + box.width <= view.width &&
          box.y >= 0 &&
          box.y + box.height <= view.height,
        JSON.stringify(box),
      );
    }
  }
  await page.goto(base + "/settings");
  await verifyRecovery();
  await page.evaluate(() =>
    localStorage.setItem("crash-recovery-sentinel", "preserved"),
  );
  await audit("mobile-light");
  await screenshot("crash-mobile-light.png");
  await page.setViewportSize({ width: 320, height: 320 });
  await verifyRecovery();
  await audit("short-light");
  await screenshot("crash-short-light.png");
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await verifyRecovery();
  await audit("mobile-dark");
  await screenshot("crash-mobile-dark.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await verifyRecovery();
  await audit("desktop-dark");
  await screenshot("crash-desktop-dark.png");
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await audit("desktop-light");
  await screenshot("crash-desktop-light.png");
  // A persistent fault must return to usable recovery, without automatic reload loops.
  await heading().focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await reload().evaluate((el) => el === document.activeElement),
    true,
  );
  const beforePersistent = navigations.length;
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.keyboard.press("Enter"),
  ]);
  await verifyRecovery();
  assert.equal(navigations.length, beforePersistent + 1);
  assert.equal(new URL(page.url()).pathname, "/settings");
  // The same native Reload action recovers the current route after the fault is removed.
  failure = "none";
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    reload().click(),
  ]);
  await page
    .getByRole("form", { name: "Change login email", exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/settings");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("crash-recovery-sentinel")),
    "preserved",
  );
  // Fail the provider itself, before it can supply authentication context.
  failure = "provider";
  await page.goto(base + "/profile");
  await verifyRecovery();
  failure = "none";
  await heading().focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(
    await workspace().evaluate((el) => el === document.activeElement),
    true,
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.keyboard.press("Enter"),
  ]);
  await page.waitForURL("**/teams");
  await page.getByRole("button", { name: /^Open user menu/ }).waitFor();
  assert.equal(await heading().count(), 0);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("crash-recovery-sentinel")),
    "preserved",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.equal(handled.length, 3);
  console.log(
    JSON.stringify({
      browser: "Edge",
      injectedFailures: handled.length,
      renderingAndProviderFailures: true,
      focusAndKeyboardActions: true,
      shortScreenActionsReachable: true,
      persistentFaultRemainsRecoverable: true,
      reloadRestoresCurrentRoute: true,
      workspaceUsesFullNavigation: true,
      storagePreserved: true,
      automaticMutationWrites: writes.length,
      scans,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

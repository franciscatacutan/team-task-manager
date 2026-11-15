// Usage: node scripts/check-notification-inbox.mjs <temporary Playwright installation directory>
// Start Vite on 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187. All APIs are mocked.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
if (!process.argv[2])
  throw new Error("Pass the temporary Playwright installation directory.");
const { chromium } = createRequire(resolve(process.argv[2], "package.json"))(
  "playwright",
);
const browser = await chromium.launch({
  executablePath:
    process.env.TTM_TEST_BROWSER ??
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : undefined),
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  let rows = Array.from({ length: 15 }, (_, id) => ({
    id: String(id),
    title: `Notice ${id}`,
    body: `A team update for notification ${id}`,
    type: "TEAM",
    targetPath: "/teams",
    actor: null,
    read: id < 12,
    createdAt: "2026-11-04T00:00:00Z",
  }));
  let failRead = true,
    failAll = true,
    failList = false;
  const requests = [],
    errors = [];
  const empty = {
    content: [],
    page: 0,
    size: 12,
    totalElements: 0,
    totalPages: 0,
    last: true,
  };
  const user = {
    userId: "probe-user",
    firstName: "Browser",
    lastName: "Probe",
    email: "probe@example.test",
    role: "USER",
  };
  const unreadCount = () => rows.filter((row) => !row.read).length;
  await context.route("http://127.0.0.1:4187/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === "/api/auth/refresh")
      return route.fulfill({
        json: { token: "probe-memory-token", expiresInSeconds: 900, user },
      });
    if (path === "/api/users/me")
      return route.fulfill({ json: { ...user, id: user.userId } });
    if (/\/notifications\/\d+\/destination$/.test(path))
      return route.fulfill({ json: { available: true, targetPath: "/teams" } });
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: unreadCount() } });
    if (path === "/api/notifications/read-all") {
      if (failAll) {
        failAll = false;
        return route.fulfill({
          status: 503,
          json: { message: "Read all was not confirmed. Try again." },
        });
      }
      rows = rows.map((row) => ({ ...row, read: true }));
      return route.fulfill({ json: { unreadCount: 0 } });
    }
    if (/\/notifications\/\d+\/read$/.test(path)) {
      if (failRead) {
        failRead = false;
        return route.fulfill({
          status: 503,
          json: { message: "Read was not confirmed. Try again." },
        });
      }
      const id = path.split("/").at(-2);
      rows = rows.map((row) => (row.id === id ? { ...row, read: true } : row));
      return route.fulfill({ json: rows.find((row) => row.id === id) });
    }
    if (path === "/api/notifications") {
      requests.push(Object.fromEntries(url.searchParams));
      if (failList)
        return route.fulfill({
          status: 503,
          json: { message: "Inbox unavailable" },
        });
      const page = Number(url.searchParams.get("page") ?? 0),
        size = Number(url.searchParams.get("size") ?? 12);
      const filtered =
        url.searchParams.get("unreadOnly") === "true"
          ? rows.filter((row) => !row.read)
          : rows;
      return route.fulfill({
        json: {
          content: filtered.slice(page * size, (page + 1) * size),
          page,
          size,
          totalElements: filtered.length,
          totalPages: Math.ceil(filtered.length / size),
          last: (page + 1) * size >= filtered.length,
        },
      });
    }
    return route.fulfill({ json: empty });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4187/teams");
  await page
    .getByRole("button", { name: "3 unread notifications", exact: true })
    .waitFor();
  assert.equal(requests.length, 0, "closed inbox should not fetch pages");
  await page
    .getByRole("button", { name: "3 unread notifications", exact: true })
    .click();
  await page.getByText("Notice 0", { exact: true }).waitFor();
  assert.match(
    await page.getByRole("status").innerText(),
    /15 notifications.*Page 1 of 2/,
  );
  await page
    .getByRole("button", { name: "Next notifications", exact: true })
    .click();
  await page.getByText("Notice 12", { exact: true }).waitFor();
  assert.match(await page.getByRole("status").innerText(), /Page 2 of 2/);
  if (process.env.TTM_TEST_SCREENSHOTS)
    await page.screenshot({
      path: resolve(
        process.env.TTM_TEST_SCREENSHOTS,
        "phase2i1-inbox-desktop.png",
      ),
    });
  await page.getByRole("button", { name: "Unread", exact: true }).click();
  await page
    .getByText("3 unread notifications · Page 1 of 1", { exact: true })
    .waitFor();
  assert.ok(
    requests.some(
      (request) => request.unreadOnly === "true" && request.page === "0",
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-slot="popover-content"]');
    return el && el.getBoundingClientRect().width <= window.innerWidth - 16;
  });
  const mobile = await page.getByRole("dialog").boundingBox();
  assert.ok(
    mobile.x >= 0 &&
      mobile.x + mobile.width <= 390 &&
      mobile.y + mobile.height <= 844,
    "inbox must fit mobile viewport",
  );
  if (process.env.TTM_TEST_SCREENSHOTS)
    await page.screenshot({
      path: resolve(
        process.env.TTM_TEST_SCREENSHOTS,
        "phase2i1-inbox-mobile.png",
      ),
    });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-slot="popover-content"]');
    return el && el.getBoundingClientRect().width <= window.innerWidth - 16;
  });
  const narrow = await page.getByRole("dialog").boundingBox();
  assert.ok(
    narrow.x >= 0 &&
      narrow.x + narrow.width <= 320 &&
      narrow.y + narrow.height <= 740,
    "inbox must fit narrow mobile viewport",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Notice 12/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Read was not confirmed" })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/teams");
  await page.getByRole("button", { name: /Notice 12/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "2 unread notifications", exact: true })
    .click();
  await page
    .getByText("2 unread notifications · Page 1 of 1", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Read all", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Read all was not confirmed" })
    .waitFor();
  await page.getByRole("button", { name: "Read all", exact: true }).click();
  await page.getByText("No unread notifications", { exact: true }).waitFor();
  await page.getByText("You are all caught up", { exact: true }).waitFor();
  // A fresh filter avoids a cached successful result while testing sustained read failure/retry.
  await page
    .getByRole("button", { name: "Open notifications", exact: true })
    .click();
  failList = true;
  await page.reload();
  await page
    .getByRole("button", { name: "Open notifications", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Unable to load notifications" })
    .waitFor();
  failList = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("Notice 0", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      inboxLoadsOnDemand: true,
      paginationWorks: true,
      olderUnreadVisible: true,
      filterResetsPage: true,
      mobilePopoverFits: true,
      markReadFailureRetained: true,
      markReadRetryUpdatesBadge: true,
      readAllFailureRetried: true,
      emptyUnreadAccurate: true,
      listFailureRetried: true,
      pageErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}

// Usage: node scripts/check-session-tabs.mjs <directory containing a temporary Playwright install>
// Run Vite on 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187; all APIs are mocked.
import { createRequire } from "node:module";
import { resolve } from "node:path";
if (!process.argv[2])
  throw new Error("Pass the temporary Playwright installation directory.");
const { chromium } = createRequire(resolve(process.argv[2], "package.json"))(
  "playwright",
);
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.TTM_TEST_BROWSER ??
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : undefined),
  headless: true,
});
const context = await browser.newContext();
let account = null,
  cookie = 0,
  running = 0,
  max = 0,
  refreshes = 0,
  reused = 0,
  fullApp = false;
let logoutStarted;
const logoutGate = new Promise((resolve) => {
  logoutStarted = resolve;
});
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const payload = () => ({
  token: `${encode({ alg: "HS256" })}.${encode({ sub: `${account}@example.test`, userId: account, role: "USER", exp: Math.floor(Date.now() / 1000) + 900 })}.token-${account}-${cookie}`,
  expiresInSeconds: 900,
  user: {
    userId: account,
    firstName: "Test",
    lastName: account,
    email: `${account}@example.test`,
    role: "USER",
  },
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await context.route("**/coordination-probe", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: "<h1>Isolated coordination test</h1>",
  }),
);
await context.route("http://127.0.0.1:4187/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/auth/login") {
    account = route.request().postDataJSON().email.split("@")[0];
    cookie++;
    return route.fulfill({
      json: payload(),
      headers: {
        "set-cookie": `refresh=${cookie}; Path=/; HttpOnly; SameSite=Lax`,
      },
    });
  }
  if (path === "/api/auth/refresh") {
    refreshes++;
    running++;
    max = Math.max(max, running);
    const supplied = (await route.request().allHeaders()).cookie;
    await sleep(35);
    if (!account || supplied !== `refresh=${cookie}`) {
      reused++;
      running--;
      return route.fulfill({ status: 401, json: {} });
    }
    cookie++;
    running--;
    return route.fulfill({
      json: payload(),
      headers: {
        "set-cookie": `refresh=${cookie}; Path=/; HttpOnly; SameSite=Lax`,
      },
    });
  }
  if (path === "/api/auth/logout") {
    logoutStarted();
    await sleep(60);
    account = null;
    return route.fulfill({
      status: 204,
      headers: {
        "set-cookie": "refresh=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
      },
    });
  }
  if (path === "/api/users/me")
    return route.fulfill({
      json: {
        id: account,
        firstName: "Test",
        lastName: account,
        email: `${account}@example.test`,
        role: "USER",
      },
    });
  if (path === "/api/teams") {
    if (!fullApp) {
      await sleep(100);
      return route.fulfill({ json: { private: "old-account-data" } });
    }
    const user = {
      id: account,
      firstName: "Test",
      lastName: account,
      email: `${account}@example.test`,
    };
    return route.fulfill({
      json: {
        content: [
          {
            key: `TEAM-${account}`,
            name: `${account} workspace`,
            owner: user,
            createdBy: user,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
            lastActivityAt: "2026-01-01",
          },
        ],
        page: 0,
        size: 12,
        totalPages: 1,
        totalElements: 1,
        last: true,
      },
    });
  }
  if (path.includes("unread-count"))
    return route.fulfill({ json: { unreadCount: 0 } });
  if (path === "/api/notifications")
    return route.fulfill({
      json: {
        content: [],
        totalElements: 0,
        totalPages: 0,
        page: 0,
        last: true,
      },
    });
  return route.fulfill({ status: 404, json: {} });
});
async function tab() {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4187/coordination-probe");
  await page.evaluate(async () => {
    const auth = await import("/src/features/auth/api/auth.api.ts");
    const { authStorage: tokens } =
      await import("/src/features/auth/utils/authStorage.ts");
    const { browserSession: coordinator } =
      await import("/src/features/auth/utils/sessionCoordinator.ts");
    const { apiClient } = await import("/src/api/apiClients.ts");
    const events = [];
    coordinator.subscribe((event) => events.push(event));
    window.probe = { auth, tokens, coordinator, apiClient, events };
  });
  return page;
}
try {
  const a = await tab(),
    b = await tab();
  assert.equal(
    await a.evaluate(() => typeof navigator.locks.request),
    "function",
  );
  await a.evaluate(() =>
    window.probe.auth.login({
      email: "alpha@example.test",
      password: "test-only",
    }),
  );
  await b.waitForFunction(() =>
    window.probe.events.some((event) => event.type === "changed"),
  );
  await b.evaluate(() => window.probe.auth.refresh());
  await Promise.all([
    a.evaluate(() => window.probe.auth.refresh()),
    b.evaluate(() => window.probe.auth.refresh()),
  ]);
  assert.equal(max, 1);
  assert.equal(reused, 0);
  const oldRead = a.evaluate(() =>
    window.probe.apiClient.get("/teams").then(
      () => "accepted",
      (error) => error.constructor.name,
    ),
  );
  await sleep(15);
  await b.evaluate(() =>
    window.probe.auth.login({
      email: "bravo@example.test",
      password: "test-only",
    }),
  );
  assert.equal(await oldRead, "AuthSessionChangedError");
  await a.evaluate(() => {
    window.probe.coordinator.sync();
  });
  const adopted = await a.evaluate(() => window.probe.auth.refresh());
  assert.equal(adopted.user.userId, "bravo");
  const ending = a.evaluate(() => window.probe.auth.logout());
  await logoutGate;
  const before = refreshes;
  const queued = b.evaluate(() =>
    window.probe.auth.refresh().then(
      () => "accepted",
      (error) => error.constructor.name,
    ),
  );
  await ending;
  assert.equal(await queued, "AuthSessionChangedError");
  assert.equal(refreshes, before);
  await b.waitForFunction(() => !window.probe.tokens.hasToken());
  const c = await tab();
  const after = refreshes;
  assert.equal(
    await c.evaluate(() =>
      window.probe.auth.refresh().then(
        () => "accepted",
        (error) => error.constructor.name,
      ),
    ),
    "SignedOutError",
  );
  assert.equal(refreshes, after);
  const storage = await a.evaluate(() => ({ ...localStorage }));
  assert.ok(
    Object.values(storage).every(
      (value) => !value.includes("token-") && !value.includes("@example.test"),
    ),
  );
  fullApp = true;
  const appA = await context.newPage(),
    appB = await context.newPage();
  await Promise.all([
    appA.goto("http://127.0.0.1:4187/login"),
    appB.goto("http://127.0.0.1:4187/login"),
  ]);
  await appA.getByLabel(/^Email/).fill("alpha@example.test");
  await appA.getByLabel(/^Password/).fill("Password1!");
  await appA.getByRole("button", { name: "Sign in", exact: true }).click();
  await Promise.all([appA.waitForURL("**/teams"), appB.waitForURL("**/teams")]);
  await appA.getByText("alpha workspace", { exact: true }).first().waitFor();
  await appB.getByText("alpha workspace", { exact: true }).first().waitFor();
  await a.evaluate(() =>
    window.probe.auth.login({
      email: "bravo@example.test",
      password: "test-only",
    }),
  );
  await appA.getByText("bravo workspace", { exact: true }).first().waitFor();
  await appB.getByText("bravo workspace", { exact: true }).first().waitFor();
  assert.equal(
    await appA.getByText("alpha workspace", { exact: true }).count(),
    0,
  );
  assert.equal(
    await appB.getByText("alpha workspace", { exact: true }).count(),
    0,
  );
  await a.evaluate(() => window.probe.auth.logout());
  await Promise.all([appA.waitForURL("**/login"), appB.waitForURL("**/login")]);
  assert.equal(
    await appA.getByText("bravo workspace", { exact: true }).count(),
    0,
  );
  process.stdout.write(
    JSON.stringify({
      browser: "Edge",
      isolatedTabs: 3,
      fullAppTabs: 2,
      maximumConcurrentRefreshes: max,
      reusedCookies: reused,
      staleReadRejected: true,
      accountSwitchAdopted: true,
      queuedRefreshBlocked: true,
      reopenedTabStayedSignedOut: true,
      tokenFreeStorage: true,
      appLoginPropagated: true,
      oldAccountViewsCleared: true,
      appLogoutPropagated: true,
    }) + "\n",
  );
} finally {
  await context.close();
  await browser.close();
}

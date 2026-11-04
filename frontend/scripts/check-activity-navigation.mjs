// Usage: node scripts/check-activity-navigation.mjs <temporary Playwright installation directory>
// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187. All APIs are mocked.
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
    viewport: { width: 1440, height: 1000 },
  });
  const user = {
    id: "viewer",
    userId: "viewer",
    firstName: "Browser",
    lastName: "Probe",
    email: "probe@example.test",
    role: "USER",
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
    createdBy: user,
    owner: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  const task = {
    taskNumber: 7,
    name: "Example task",
    status: "TODO",
    priority: "LOW",
    assignedUser: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: user.email, userId: user.id, role: "USER", exp: Math.floor(Date.now() / 1000) + 900 })}.mock-signature`;
  const events = Array.from({ length: 25 }, (_, id) => ({
    id: `event-${id}`,
    message: `History row ${id}`,
    type: "TASK_COMMENTED",
    details: { fields: [], from: null, to: null, target: null },
    user: {
      id: id < 5 ? "ada" : "zed",
      firstName: id < 5 ? "Ada" : "Zed",
      lastName: "Person",
      email: id === 24 ? "mail-only@example.test" : "actor@example.test",
    },
    task: { id: "task-id", name: task.name, taskNumber: 7 },
    project: { id: "project-id", name: project.name, key: "PROJECT" },
    targetPath: "/teams/TEAM/projects/PROJECT/tasks/7",
    createdAt: new Date(Date.parse(date) - id * 1000).toISOString(),
  }));
  let notices = [
    {
      id: "1",
      type: "TASK",
      title: "Removed access",
      body: "Retained historical notice",
      read: false,
      actor: null,
      targetPath: "/old/unsafe",
      createdAt: date,
    },
    {
      id: "2",
      type: "TASK",
      title: "Available task",
      body: "Open the current task route",
      read: false,
      actor: null,
      targetPath: "/old/stale",
      createdAt: date,
    },
  ];
  const requests = [],
    errors = [];
  const paged = (content, page = 0, size = 20) => ({
    content: content.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: content.length,
    totalPages: Math.ceil(content.length / size),
    last: (page + 1) * size >= content.length,
  });
  await context.route("http://127.0.0.1:4187/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path === "/api/auth/refresh")
      return route.fulfill({ json: { token, expiresInSeconds: 900, user } });
    if (path === "/api/users/me") return route.fulfill({ json: user });
    if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
    if (path === "/api/teams/TEAM/me")
      return route.fulfill({ json: { userId: user.id, role: "OWNER" } });
    if (path === "/api/teams/TEAM/projects/PROJECT")
      return route.fulfill({ json: project });
    if (path === "/api/teams/TEAM/projects/PROJECT/tasks/7")
      return route.fulfill({ json: task });
    if (path.endsWith("/activities")) {
      requests.push(Object.fromEntries(url.searchParams));
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      let rows = events.filter(
        (event) =>
          event.message.toLowerCase().includes(search) ||
          event.user.email.includes(search),
      );
      if (url.searchParams.get("sort") === "createdAt,asc")
        rows = [...rows].reverse();
      return route.fulfill({
        json: paged(
          rows,
          Number(url.searchParams.get("page") ?? 0),
          Number(url.searchParams.get("size") ?? 20),
        ),
      });
    }
    if (path === "/api/notifications/unread-count")
      return route.fulfill({
        json: { unreadCount: notices.filter((item) => !item.read).length },
      });
    if (/\/notifications\/\d+\/destination$/.test(path)) {
      const available = path.includes("/2/");
      return route.fulfill({
        json: {
          available,
          targetPath: available ? "/teams/TEAM/projects/PROJECT/tasks/7" : null,
        },
      });
    }
    if (/\/notifications\/\d+\/read$/.test(path)) {
      const id = path.split("/").at(-2);
      notices = notices.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      );
      return route.fulfill({ json: notices.find((item) => item.id === id) });
    }
    if (path === "/api/notifications")
      return route.fulfill({ json: paged(notices) });
    return route.fulfill({ json: paged([]) });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4187/teams/TEAM/activity");
  await page.getByText("History row 0", { exact: true }).waitFor();
  assert.ok(requests.some((item) => item.size === "20"));
  await page
    .getByRole("combobox", { name: "Group activity on this page", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Group: Person", exact: true })
    .click();
  const headings = await page
    .getByRole("heading", { level: 3 })
    .allTextContents();
  assert.deepEqual(headings, ["Ada Person", "Zed Person"]);
  await page
    .getByText("Grouped on this page. Search covers the full history.", {
      exact: true,
    })
    .waitFor();
  if (process.env.TTM_TEST_SCREENSHOTS)
    await page.screenshot({
      path: resolve(
        process.env.TTM_TEST_SCREENSHOTS,
        "phase2i2-activity-desktop.png",
      ),
    });
  await page
    .getByRole("button", { name: "Next activity page", exact: true })
    .click();
  await page.getByText("History row 24", { exact: true }).waitFor();
  const input = page.getByRole("textbox", {
    name: "Search team activity...",
    exact: true,
  });
  await input.fill("mail-only");
  await page
    .getByText("1 matching event · Page 1 of 1", { exact: true })
    .waitFor();
  assert.equal(
    await input.evaluate((el) => document.activeElement === el),
    true,
  );
  assert.ok(
    requests.some((item) => item.page === "0" && item.search === "mail-only"),
  );
  await page.getByText("History row 24", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "2 unread notifications", exact: true })
    .click();
  await page.getByRole("button", { name: /Removed access/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Destination unavailable" })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/teams/TEAM/activity");
  assert.equal(notices.find((item) => item.id === "1").read, true);
  await page
    .getByRole("button", { name: "1 unread notifications", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Available task/ }).click();
  await page.waitForURL("**/teams/TEAM/projects/PROJECT/tasks/7");
  await page.getByText("History row 0", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      boundedHistoryPages: true,
      chronologicalGroups: true,
      groupingScopeLabeled: true,
      olderSearchMatchFound: true,
      searchResetsPage: true,
      inputFocusRetained: true,
      unavailableNotificationReadAndRetained: true,
      unavailableStaysInInbox: true,
      freshTaskRouteOpened: true,
      pageErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}

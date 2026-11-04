// Start Vite on 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-task-view.mjs <temporary Playwright installation directory>
// All API traffic is mocked; no development database is used.
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
  const errors = [],
    writes = [];
  const user = {
    id: "viewer",
    userId: "viewer",
    firstName: "Browser",
    lastName: "Owner",
    email: "owner@example.test",
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
    owner: user,
    createdBy: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  let task = {
    taskNumber: 7,
    name: "Shared browser task",
    description: "Same content in page and dialog",
    status: "TODO",
    priority: "LOW",
    assignedUser: user,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  let unavailable = false,
    comments = [];
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256" })}.${encode({ sub: user.email, userId: user.id, role: "USER", exp: Math.floor(Date.now() / 1000) + 900 })}.mock-signature`;
  const paged = (content = []) => ({
    content,
    page: 0,
    size: 20,
    totalPages: content.length ? 1 : 0,
    totalElements: content.length,
    first: true,
    last: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("http://127.0.0.1:4187/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      method = route.request().method();
    if (method !== "GET" && path !== "/api/auth/refresh")
      writes.push({ path, method, body: route.request().postDataJSON() });
    if (path === "/api/auth/refresh")
      return route.fulfill({ json: { token, expiresInSeconds: 900, user } });
    if (path === "/api/users/me") return route.fulfill({ json: user });
    if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
    if (path === "/api/teams/TEAM/me")
      return route.fulfill({ json: { userId: user.id, role: "OWNER" } });
    if (path === "/api/teams/TEAM/projects/PROJECT")
      return route.fulfill({ json: project });
    if (path === "/api/teams/TEAM/projects/PROJECT/tasks/7") {
      if (unavailable)
        return route.fulfill({
          status: 403,
          json: { message: "Access denied" },
        });
      if (method === "PATCH")
        task = { ...task, ...route.request().postDataJSON() };
      return route.fulfill({ json: task });
    }
    if (path.endsWith("/tasks/7/activities")) {
      if (method === "POST") {
        const body = route.request().postDataJSON();
        const event = {
          id: `comment-${comments.length}`,
          type: "TASK_COMMENTED",
          message: body.message,
          user,
          createdAt: date,
          task: { id: "task-id", name: task.name, taskNumber: 7 },
          project: { id: "project-id", name: project.name, key: "PROJECT" },
          details: { fields: [] },
        };
        comments.push(event);
        return route.fulfill({ json: event });
      }
      return route.fulfill({ json: paged(comments) });
    }
    if (path.endsWith("/tasks")) {
      const statuses = url.searchParams.getAll("status");
      return route.fulfill({
        json: paged(
          !statuses.length || statuses.includes(task.status) ? [task] : [],
        ),
      });
    }
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 0 } });
    if (path.endsWith("/insights/summary"))
      return route.fulfill({ json: null });
    return route.fulfill({ json: paged() });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const taskUrl = "http://127.0.0.1:4187/teams/TEAM/projects/PROJECT/tasks/7";
  const projectUrl = "http://127.0.0.1:4187/teams/TEAM/projects/PROJECT";
  async function screenshot(name) {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(process.env.TTM_TEST_SCREENSHOTS, name),
      });
  }
  async function editName(container, name) {
    await container
      .getByRole("button", { name: "Edit name", exact: true })
      .click();
    await container
      .getByRole("textbox", { name: "Edit name", exact: true })
      .fill(name);
    await container.getByRole("button", { name: "Save", exact: true }).click();
    await container.getByText(name, { exact: true }).waitFor();
  }
  await page.goto(taskUrl);
  await page.getByRole("button", { name: "Edit name", exact: true }).waitFor();
  await editName(page, "Renamed from page");
  await page.getByPlaceholder("Write a comment...").fill("Page comment");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.getByText("Page comment", { exact: true }).waitFor();
  await screenshot("phase2j1-task-page-desktop.png");
  await page.goto(projectUrl);
  await page
    .getByRole("heading", { name: "Renamed from page", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Task #7", exact: true });
  await dialog.waitFor();
  assert.equal(
    await dialog
      .getByRole("heading", { name: "Task #7", exact: true })
      .locator("button,input,textarea,[role=button]")
      .count(),
    0,
  );
  await dialog.getByText("Page comment", { exact: true }).waitFor();
  await editName(dialog, "Renamed from dialog");
  await dialog.getByPlaceholder("Write a comment...").fill("Unsent draft");
  await screenshot("phase2j1-task-dialog-desktop.png");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("heading", { name: "Renamed from dialog", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Task #7", exact: true });
  await dialog.waitFor();
  assert.equal(
    await dialog.getByPlaceholder("Write a comment...").inputValue(),
    "",
  );
  await dialog.getByPlaceholder("Write a comment...").fill("Dialog comment");
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await dialog.getByText("Dialog comment", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog
    .getByText("Dialog comment", { exact: true })
    .scrollIntoViewIfNeeded();
  await screenshot("phase2j1-task-dialog-mobile.png");
  const bounds = await dialog.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  task = { ...task, readOnly: true };
  await page.goto(taskUrl);
  await page.getByRole("button", { name: "Edit name", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Edit name", exact: true })
      .getAttribute("aria-disabled"),
    "true",
  );
  assert.equal(await page.getByPlaceholder("Write a comment...").count(), 0);
  await page.getByText("Dialog comment", { exact: true }).waitFor();
  await screenshot("phase2j1-task-page-mobile.png");
  unavailable = true;
  await page.goto(taskUrl);
  await page.getByText("Task unavailable", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Edit name", exact: true }).count(),
    0,
  );
  unavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Edit name", exact: true }).waitFor();
  assert.equal(writes.filter((item) => item.method === "PATCH").length, 2);
  assert.equal(
    writes.filter((item) => item.path.endsWith("/activities")).length,
    2,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      taskPageAndDialog: true,
      confirmedSaves: 2,
      comments: 2,
      draftReset: true,
      readOnly: true,
      deniedReadRetry: true,
      mobileDialogFits: true,
      pageErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}

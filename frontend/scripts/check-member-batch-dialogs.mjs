// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-member-batch-dialogs.mjs <temporary Playwright + @axe-core/playwright installation>
// All APIs are mocked; no real membership data is changed.
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
        () => fail(new Error("Save request was not observed")),
        10000,
      );
      onWrite = () => {
        clearTimeout(timeout);
        done();
      };
    });
  }
  const date = "2026-11-04T00:00:00Z";
  const candidates = users.slice(1, 13);
  const member = (user, role = "MEMBER") => ({
    ...user,
    teamRole: role,
    globalRole: user.role,
    joinedAt: date,
  });
  let members = [member(admin, "OWNER")],
    available = [...candidates];
  const team = {
    key: "TEAM",
    name: "Customer delivery",
    description: "Coordinate the launch.",
    owner: admin,
    createdBy: admin,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  };
  const paged = (content) => ({
    content,
    page: 0,
    size: 1000,
    totalPages: content.length ? 1 : 0,
    totalElements: content.length,
    last: true,
  });
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
    if (path === "/api/teams") return route.fulfill({ json: paged([team]) });
    if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
    if (path === "/api/teams/TEAM/me")
      return route.fulfill({ json: { userId: admin.id, role: "OWNER" } });
    if (
      path.endsWith("/members") &&
      ["POST", "DELETE"].includes(request.method())
    ) {
      const body = request.postDataJSON();
      writes.push({ method: request.method(), body });
      const result = await new Promise((done) => {
        release = done;
        onWrite?.();
        onWrite = undefined;
      });
      const successIds = new Set(
        result.success.map((value) =>
          typeof value === "string" ? value : value.id,
        ),
      );
      if (request.method() === "POST") {
        members = [...members, ...result.success];
        available = available.filter((user) => !successIds.has(user.id));
      } else members = members.filter((user) => !successIds.has(user.id));
      return route.fulfill({ json: result });
    }
    if (path.endsWith("/members") || path.endsWith("/available-users")) {
      const source = path.endsWith("/available-users") ? available : members;
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      return route.fulfill({
        json: paged(
          source.filter((user) =>
            `${user.firstName} ${user.lastName} ${user.email}`
              .toLowerCase()
              .includes(search),
          ),
        ),
      });
    }
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 0 } });
    return route.fulfill({ json: paged([]) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  async function settle(dialog) {
    await dialog.evaluate(async (el) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await Promise.all(
        el
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
  async function audit(selector, state) {
    const result = await new AxeBuilder({ page })
      .include(selector)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    }));
    scans.push({ state, violations });
    assert.deepEqual(violations, [], state);
  }
  async function bounds(dialog, button) {
    await settle(dialog);
    const box = await dialog.boundingBox(),
      view = page.viewportSize();
    assert.ok(
      box.y >= 8 && box.y + box.height <= view.height - 8,
      JSON.stringify(box),
    );
    assert.ok(
      box.x >= 8 && box.x + box.width <= view.width - 8,
      JSON.stringify(box),
    );
    for (const control of [
      dialog.getByRole("heading"),
      dialog.getByRole("button", { name: "Close", exact: true }),
      button,
    ]) {
      const b = await control.boundingBox();
      assert.ok(
        b.y >= box.y && b.y + b.height <= box.y + box.height,
        JSON.stringify(b),
      );
    }
    assert.equal(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
  }
  async function trap(dialog) {
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
        true,
      );
    }
  }
  async function selectSix(dialog, name) {
    const picker = dialog.getByRole("combobox", { name, exact: true });
    await picker.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("combobox", { name: "Search users", exact: true })
      .waitFor();
    for (const user of candidates.slice(0, 6))
      await page.getByRole("option").filter({ hasText: user.email }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("combobox", { name: "Search users", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(await dialog.isVisible(), true);
  }
  async function lockCheck(dialog, action, name) {
    assert.equal(
      await dialog
        .getByRole("button", { name: "Close", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await dialog
        .getByRole("button", { name: "Cancel", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(await action.isDisabled(), true);
    assert.equal(
      await dialog
        .getByRole("combobox", { name, exact: true })
        .getAttribute("aria-disabled"),
      "true",
    );
    for (const badge of await dialog
      .getByRole("button", { name: /^Remove (Ada|Person)/ })
      .all())
      assert.equal(await badge.isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    assert.equal(await dialog.isVisible(), true);
  }
  async function visibleSummary(dialog, verb) {
    const alert = dialog.getByRole("alert");
    await alert.filter({ hasText: `${verb} 5 members. 1 failed.` }).waitFor();
    await settle(dialog);
    assert.equal(
      await alert.evaluate((el) => {
        const b = el.getBoundingClientRect(),
          p = el
            .closest("form")
            .querySelector("div.overflow-y-auto")
            .getBoundingClientRect();
        return b.top >= p.top && b.top < p.bottom;
      }),
      true,
      "partial result summary must scroll into view",
    );
  }
  await page.goto(base + "/teams/TEAM/members");
  await page.getByRole("button", { name: "Add members", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add member", exact: true });
  await selectSix(dialog, "Users");
  const last = candidates[5],
    lastRole = `Role for ${last.firstName} ${last.lastName}`;
  await dialog.getByRole("combobox", { name: lastRole, exact: true }).click();
  await page.getByRole("option", { name: "Admin", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 500 });
  let submit = dialog.getByRole("button", {
    name: "Add 6 members",
    exact: true,
  });
  await bounds(dialog, submit);
  assert.equal(
    await dialog.getByRole("form").evaluate((el) => {
      const b = el.querySelector("div.overflow-y-auto");
      return b.scrollHeight > b.clientHeight;
    }),
    true,
  );
  await audit('[data-slot="dialog-content"]', "add-short-long-selection");
  await shot("add-short-selected.png");
  // Open the real picker on the short screen, search, then return to the unchanged draft.
  await dialog.getByRole("combobox", { name: "Users", exact: true }).focus();
  await page.keyboard.press(" ");
  const search = page.getByRole("combobox", {
    name: "Search users",
    exact: true,
  });
  await search.fill(last.email);
  await page.getByRole("option").filter({ hasText: last.email }).waitFor();
  const popup = page.locator(
    '[data-slot="popover-content"][data-state="open"]',
  );
  await settle(popup);
  const b = await popup.boundingBox();
  assert.ok(
    b.y >= 0 && b.y + b.height <= 500 && b.x >= 0 && b.x + b.width <= 390,
    JSON.stringify(b),
  );
  await audit(
    '[data-slot="popover-content"][data-state="open"]',
    "add-short-picker",
  );
  await shot("add-short-picker.png");
  await search.fill("");
  await page.keyboard.press("Escape");
  await search.waitFor({ state: "hidden" });
  let arrival = nextWrite();
  await submit.click();
  await arrival;
  await lockCheck(
    dialog,
    dialog.getByRole("button", { name: "Adding...", exact: true }),
    "Users",
  );
  for (const role of await dialog
    .getByRole("combobox", { name: /^Role for/ })
    .all())
    assert.equal(await role.isDisabled(), true);
  await shot("add-short-pending.png");
  const firstRequest = writes[0].body;
  const added = firstRequest.members.slice(0, 5).map((input) =>
    member(
      candidates.find((user) => user.id === input.userId),
      input.role,
    ),
  );
  release({
    success: added,
    failed: [
      {
        userId: last.id,
        reason: "Temporary conflict. Retry this member.",
        code: "CONFLICT",
      },
    ],
  });
  await visibleSummary(dialog, "Added");
  await trap(dialog);
  assert.match(
    await dialog
      .getByRole("combobox", { name: lastRole, exact: true })
      .innerText(),
    /Admin/,
  );
  submit = dialog.getByRole("button", { name: "Add 1 member", exact: true });
  await bounds(dialog, submit);
  await audit('[data-slot="dialog-content"]', "add-short-partial");
  await shot("add-short-partial.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await bounds(dialog, submit);
  await audit('[data-slot="dialog-content"]', "add-desktop-dark-partial");
  await shot("add-desktop-dark-partial.png");
  arrival = nextWrite();
  await submit.click();
  await arrival;
  assert.deepEqual(writes[1].body, {
    members: [{ userId: last.id, role: "ADMIN" }],
  });
  release({ success: [member(last, "ADMIN")], failed: [] });
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Add members", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Add member", exact: true });
  assert.equal(await dialog.getByRole("alert").count(), 0);
  assert.equal(
    await dialog
      .getByRole("button", { name: "Add members", exact: true })
      .isDisabled(),
    true,
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  await page
    .getByRole("button", { name: "Remove members", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Remove members", exact: true });
  await selectSix(dialog, "Members");
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  submit = dialog.getByRole("button", {
    name: "Remove 6 members",
    exact: true,
  });
  await bounds(dialog, submit);
  await audit('[data-slot="dialog-content"]', "remove-short-selected");
  await shot("remove-short-selected.png");
  arrival = nextWrite();
  await submit.click();
  await arrival;
  await lockCheck(
    dialog,
    dialog.getByRole("button", { name: "Removing...", exact: true }),
    "Members",
  );
  await shot("remove-short-pending.png");
  release({
    success: candidates.slice(0, 5).map((user) => user.id),
    failed: [
      {
        userId: last.id,
        reason: "Temporary conflict. Retry this member.",
        code: "CONFLICT",
      },
    ],
  });
  await visibleSummary(dialog, "Removed");
  await trap(dialog);
  submit = dialog.getByRole("button", { name: "Remove 1 member", exact: true });
  await bounds(dialog, submit);
  await audit('[data-slot="dialog-content"]', "remove-short-partial");
  await shot("remove-short-partial.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await bounds(dialog, submit);
  await audit('[data-slot="dialog-content"]', "remove-desktop-dark-partial");
  await shot("remove-desktop-dark-partial.png");
  arrival = nextWrite();
  await submit.click();
  await arrival;
  assert.deepEqual(writes[3].body, { userIds: [last.id] });
  release({ success: [last.id], failed: [] });
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  assert.equal(writes.length, 4);
  console.log(
    JSON.stringify({
      browser: "Edge",
      shortViewport: "390x500",
      desktop: "1440x1000",
      fixedReachableActions: true,
      scrollingBody: true,
      pickerKeyboardSearchAndBounds: true,
      pendingEditingAndDismissalBlocked: true,
      partialResultsVisible: true,
      dialogFocusContained: true,
      failedAddRoleRetained: true,
      retriedOnlyUnsuccessfulMembers: true,
      writeRequests: 4,
      scans,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

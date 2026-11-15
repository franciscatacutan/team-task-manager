// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-edit-ownership-dialogs.mjs <temporary Playwright + @axe-core/playwright installation>
// All APIs are mocked; no real user or ownership data is changed.
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
  let membershipRole = "OWNER";
  const member = (user) => ({
    ...user,
    teamRole: user.id === admin.id ? membershipRole : "MEMBER",
    joinedAt: date,
  });
  const team = () => ({
    key: "TEAM",
    name: "Customer delivery",
    description: "Coordinate the launch.",
    owner: membershipRole === "OWNER" ? admin : users[1],
    createdBy: admin,
    createdAt: date,
    updatedAt: date,
    lastActivityAt: date,
  });
  const paged = (content) => ({
    content,
    page: 0,
    size: 20,
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
    if (path === "/api/users") {
      const page = Number(url.searchParams.get("page") ?? 0),
        size = Number(url.searchParams.get("size") ?? 10);
      return route.fulfill({
        json: {
          ...paged(users.slice(page * size, (page + 1) * size)),
          page,
          size,
          totalElements: users.length,
          totalPages: Math.ceil(users.length / size),
        },
      });
    }
    if (request.method() === "PATCH") {
      const body = request.postDataJSON();
      writes.push({ path, body });
      const result = await new Promise((done) => {
        release = done;
        onWrite?.();
        onWrite = undefined;
      });
      if (result.status) return route.fulfill(result);
      if (path.includes("/transfer/")) {
        membershipRole = "ADMIN";
        return route.fulfill({
          json: { ...member(users[1]), teamRole: "OWNER" },
        });
      }
      const index = users.findIndex((user) => path.endsWith("/" + user.id));
      assert.ok(index >= 0, path);
      users[index] = { ...users[index], ...body };
      return route.fulfill({ json: users[index] });
    }
    if (path === "/api/teams") return route.fulfill({ json: paged([team()]) });
    if (path === "/api/teams/TEAM") return route.fulfill({ json: team() });
    if (path === "/api/teams/TEAM/me")
      return route.fulfill({
        json: { userId: admin.id, role: membershipRole },
      });
    if (path.endsWith("/members")) {
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      return route.fulfill({
        json: paged(
          [member(admin), ...users.slice(1, 3).map(member)].filter((user) =>
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
  async function visibleError(dialog) {
    await settle(dialog);
    const visible = await dialog.getByRole("alert").evaluate((el) => {
      const b = el.getBoundingClientRect(),
        body = el.closest("form").getBoundingClientRect();
      return b.top >= body.top && b.bottom <= body.bottom;
    });
    assert.equal(
      visible,
      true,
      "save error must be visible within the scrolling body",
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
  async function lockCheck(dialog, button) {
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
    assert.equal(await button.isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    assert.equal(await dialog.isVisible(), true);
  }
  async function openEdit(target = 0) {
    await page
      .getByRole("row")
      .filter({ hasText: `person${target}@example.test` })
      .getByRole("button")
      .click();
    await page
      .getByRole("menuitem", { name: "Edit User", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Edit user", exact: true });
    await dialog.waitFor();
    return dialog;
  }
  await page.goto(base + "/users");
  let dialog = await openEdit();
  await page.setViewportSize({ width: 390, height: 500 });
  assert.equal(
    await dialog
      .getByRole("form")
      .evaluate(
        (el) =>
          getComputedStyle(el).overflowY === "auto" &&
          el.scrollHeight > el.clientHeight,
      ),
    true,
  );

  let save = dialog.getByRole("button", { name: "Save changes", exact: true });
  await bounds(dialog, save);
  await trap(dialog);
  await dialog.getByLabel("First name", { exact: true }).fill("   ");
  await dialog
    .getByRole("alert")
    .filter({ hasText: "First name is required" })
    .waitFor();
  assert.equal(
    await dialog
      .getByLabel("First name", { exact: true })
      .getAttribute("aria-invalid"),
    "true",
  );
  await audit(dialog, "edit-short-validation");
  await dialog.getByLabel("First name", { exact: true }).fill("Updated");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("updated@example.test");
  await dialog
    .getByRole("combobox", { name: "Global role", exact: true })
    .click();
  await page.getByRole("option", { name: "Admin", exact: true }).click();
  await bounds(dialog, save);
  await audit(dialog, "edit-short-ready");
  await shot("edit-user-short-ready.png");
  let arrival = nextWrite();
  await save.click();
  await arrival;
  await lockCheck(
    dialog,
    dialog.getByRole("button", { name: "Saving...", exact: true }),
  );
  for (const label of ["First name", "Last name", "Email"])
    assert.equal(
      await dialog.getByLabel(label, { exact: true }).isDisabled(),
      true,
    );
  assert.equal(
    await dialog
      .getByRole("combobox", { name: "Global role", exact: true })
      .isDisabled(),
    true,
  );
  await shot("edit-user-short-pending.png");
  release({
    status: 409,
    json: { message: "Email already exists. Please retry." },
  });
  await dialog
    .getByRole("alert")
    .filter({ hasText: "Email already exists" })
    .waitFor();
  assert.equal(
    await dialog.getByLabel("First name", { exact: true }).inputValue(),
    "Updated",
  );
  assert.equal(
    await dialog.getByLabel("Email", { exact: true }).inputValue(),
    "updated@example.test",
  );
  assert.match(
    await dialog.getByRole("combobox", { name: "Global role" }).innerText(),
    /Admin/,
  );
  await bounds(dialog, save);
  await visibleError(dialog);
  await audit(dialog, "edit-short-error");
  await shot("edit-user-short-error.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await bounds(dialog, save);
  await audit(dialog, "edit-desktop-dark-error");
  await shot("edit-user-desktop-dark-error.png");
  arrival = nextWrite();
  await save.click();
  await arrival;
  release({});
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(writes[0], writes[1]);
  dialog = await openEdit(1);
  assert.equal(await dialog.getByLabel("First name").inputValue(), "Ada");
  assert.equal(await dialog.getByRole("alert").count(), 0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  async function ownershipFlow(recovery) {
    membershipRole = recovery ? "ADMIN" : "OWNER";
    await page.setViewportSize({ width: 390, height: 500 });
    await page.goto(base + "/teams/TEAM/members");
    await page
      .getByRole("button", { name: "Transfer ownership", exact: true })
      .click();
    const d = page.getByRole("dialog", {
      name: recovery ? "Recover team ownership" : "Transfer ownership",
      exact: true,
    });
    await d.waitFor();
    const button = d.getByRole("button", {
      name: "Transfer ownership",
      exact: true,
    });
    await bounds(d, button);
    await trap(d);
    await d.getByRole("combobox", { name: "New owner", exact: true }).click();
    await page.getByPlaceholder("Search user...").fill("Member0");
    await page
      .getByRole("option")
      .filter({ hasText: "updated@example.test" })
      .click();
    await d.getByLabel("Type TRANSFER to confirm").fill("TRANSFER");
    await audit(d, recovery ? "recovery-short-ready" : "ownership-short-ready");
    await shot(
      recovery ? "recovery-short-ready.png" : "ownership-short-ready.png",
    );
    let observed = nextWrite();
    await button.click();
    await observed;
    await lockCheck(
      d,
      d.getByRole("button", { name: "Transferring...", exact: true }),
    );
    assert.equal(
      await d
        .getByRole("combobox", { name: "New owner", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await d.getByLabel("Type TRANSFER to confirm").isDisabled(),
      true,
    );
    release({
      status: 409,
      json: { message: "Ownership transfer rejected. Please retry." },
    });
    await d
      .getByRole("alert")
      .filter({ hasText: "Ownership transfer rejected" })
      .waitFor();
    assert.equal(
      await d.getByLabel("Type TRANSFER to confirm").inputValue(),
      "TRANSFER",
    );
    assert.match(
      await d
        .getByRole("combobox", { name: "New owner", exact: true })
        .innerText(),
      /Updated/,
    );
    await bounds(d, button);
    await visibleError(d);
    await audit(d, recovery ? "recovery-short-error" : "ownership-short-error");
    await shot(
      recovery ? "recovery-short-error.png" : "ownership-short-error.png",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await bounds(d, button);
    await audit(
      d,
      recovery ? "recovery-desktop-dark-error" : "ownership-desktop-dark-error",
    );
    await shot(
      recovery
        ? "recovery-desktop-dark-error.png"
        : "ownership-desktop-dark-error.png",
    );
    observed = nextWrite();
    await button.click();
    await observed;
    release({});
    await d.waitFor({ state: "hidden" });
    assert.deepEqual(writes.at(-1), writes.at(-2));
  }
  await ownershipFlow(false);
  await ownershipFlow(true);
  assert.deepEqual(errors, []);
  assert.equal(writes.length, 6);
  console.log(
    JSON.stringify({
      browser: "Edge",
      shortViewport: "390x500",
      desktop: "1440x1000",
      headerFooterReachable: true,
      bodyScrollable: true,
      pendingEscapeBackdropBlocked: true,
      fieldsAndCloseLocked: true,
      failedDraftsRetained: true,
      atomicUserRetry: true,
      ownerAndRecovery: true,
      writeRequests: 6,
      successfulWrites: 3,
      failureNoticeVisible: true,
      scans,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

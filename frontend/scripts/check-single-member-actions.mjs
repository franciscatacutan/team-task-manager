// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-single-member-actions.mjs <temporary Playwright + axe installation>
// All API requests, including writes, are mocked. No development data is changed.
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
    scans = [],
    outcomes = [];
  const date = "2026-11-05T00:00:00Z";
  for (const config of [
    { width: 1440, height: 1000, dark: false },
    { width: 390, height: 844, dark: true },
    {
      width: 320,
      height: 320,
      dark: false,
      setupWidth: 1440,
      setupHeight: 1000,
    },
  ]) {
    const name = `${config.width}-${config.height}-${config.dark ? "dark" : "light"}`;
    const viewer = {
      id: "owner",
      userId: "owner",
      firstName: "Olivia",
      lastName: "Owner",
      email: "owner@example.test",
      role: "USER",
    };
    const alice = {
      id: "alice",
      firstName: "Alice",
      lastName: "Member",
      email: "alice@example.test",
      teamRole: "MEMBER",
      joinedAt: date,
    };
    const bob = {
      ...alice,
      id: "bob",
      firstName: "Bob",
      email: "bob@example.test",
    };
    let members = [
      { ...viewer, teamRole: "OWNER", joinedAt: date, globalRole: "USER" },
      alice,
      bob,
    ];
    const team = {
      key: "TEAM",
      name: "Customer delivery",
      description: "Coordinate the launch.",
      owner: viewer,
      createdBy: viewer,
      createdAt: date,
      updatedAt: date,
      lastActivityAt: date,
      deletedAt: null,
    };
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "HS256" })}.${encode({ sub: viewer.email, userId: viewer.id, role: viewer.role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock`;
    const paged = (content) => ({
      content,
      page: 0,
      size: 10,
      totalElements: content.length,
      totalPages: content.length ? 1 : 0,
      last: true,
    });
    const roleHeld = Promise.withResolvers(),
      removalHeld = Promise.withResolvers();
    let releaseRole,
      releaseRemoval,
      roleCount = 0,
      removeCount = 0;
    const writes = [];
    const context = await browser.newContext({
      viewport: {
        width: config.setupWidth ?? config.width,
        height: config.setupHeight ?? config.height,
      },
    });
    await context.route(`${base}/api/**`, async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname;
      if (path === "/api/auth/refresh")
        return route.fulfill({
          json: { token, user: viewer, expiresInSeconds: 900 },
        });
      if (
        req.method() === "PATCH" &&
        path === "/api/teams/TEAM/members/alice/role"
      ) {
        roleCount++;
        const data = req.postDataJSON();
        writes.push({ method: "PATCH", path, data });
        if (roleCount === 1) {
          await new Promise((done) => {
            releaseRole = done;
            roleHeld.resolve();
          });
          return route.fulfill({
            status: 409,
            json: { message: "The role could not be changed. Try again." },
          });
        }
        assert.deepEqual(data, { role: "ADMIN" });
        members = members.map((member) =>
          member.id === alice.id ? { ...member, teamRole: data.role } : member,
        );
        return route.fulfill({
          json: members.find((member) => member.id === alice.id),
        });
      }
      if (req.method() === "DELETE" && path === "/api/teams/TEAM/members") {
        removeCount++;
        const data = req.postDataJSON();
        writes.push({ method: "DELETE", path, data });
        assert.deepEqual(data, { userIds: [alice.id] });
        if (removeCount === 1) {
          await new Promise((done) => {
            releaseRemoval = done;
            removalHeld.resolve();
          });
          return route.fulfill({
            json: {
              success: [],
              failed: [
                {
                  userId: alice.id,
                  code: "CONFLICT",
                  reason:
                    "Removal could not be completed. " +
                    "Retain this member for retry after the request settles. ".repeat(
                      18,
                    ),
                },
              ],
            },
          });
        }
        members = members.filter((member) => member.id !== alice.id);
        return route.fulfill({ json: { success: [alice.id], failed: [] } });
      }
      if (req.method() !== "GET")
        throw new Error(`Unexpected write ${req.method()} ${path}`);
      if (path === "/api/users/me") return route.fulfill({ json: viewer });
      if (path === "/api/teams") return route.fulfill({ json: paged([team]) });
      if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
      if (path === "/api/teams/TEAM/me")
        return route.fulfill({ json: { userId: viewer.id, role: "OWNER" } });
      if (path === "/api/teams/TEAM/members")
        return route.fulfill({ json: paged(members) });
      if (path === "/api/notifications/unread-count")
        return route.fulfill({ json: { unreadCount: 0 } });
      return route.fulfill({ json: paged([]) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/teams/TEAM/members");
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      config.dark,
    );
    const aliceRole = page.getByRole("combobox", {
      name: "Team role for Alice Member",
      exact: true,
    });
    const bobRole = page.getByRole("combobox", {
      name: "Team role for Bob Member",
      exact: true,
    });
    await aliceRole.waitFor();
    async function settle() {
      await page.evaluate(async () => {
        await new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        );
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (a) => a.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((a) => a.finished.catch(() => {})),
        );
      });
    }
    async function scan(locator, state) {
      await locator.scrollIntoViewIfNeeded();
      await settle();
      if (state.startsWith("role-")) {
        const fits = await locator.evaluate(
          (el) => el.scrollWidth <= el.clientWidth + 1,
        );
        assert(fits, `${name}-${state}: role feedback overflows its cell`);
      }
      await locator.evaluate((el) => (el.id = "single-action-probe"));
      const result = await new AxeBuilder({ page })
        .include("#single-action-probe")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const violations = result.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      }));
      scans.push({
        state: `${name}-${state}`,
        viewport: page.viewportSize(),
        violations,
      });
      assert.deepEqual(violations, [], `${name}-${state}`);
      await locator.evaluate((el) => el.removeAttribute("id"));
    }
    async function shot(state) {
      if (process.env.TTM_TEST_SCREENSHOTS)
        await page.screenshot({
          path: resolve(
            process.env.TTM_TEST_SCREENSHOTS,
            `${config.setupWidth && state.startsWith("role-") ? `short-dialog-setup-${config.setupWidth}-${config.setupHeight}-${config.dark ? "dark" : "light"}` : name}-${state}.png`,
          ),
        });
    }
    async function footerReachable(dialog) {
      for (const label of ["Cancel", "Remove"]) {
        const button = dialog.getByRole("button", { name: label, exact: true });
        const bounds = await button.boundingBox();
        assert(
          bounds &&
            bounds.x >= 0 &&
            bounds.y >= 0 &&
            bounds.x + bounds.width <= config.width + 1 &&
            bounds.y + bounds.height <= config.height + 1,
          `${name}: unreachable ${label}`,
        );
      }
      assert(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      );
    }
    await aliceRole.focus();
    await page.keyboard.press("ArrowDown");
    await page.getByRole("option", { name: "Admin", exact: true }).click();
    await roleHeld.promise;
    await page
      .getByRole("status")
      .filter({ hasText: "Updating team role for Alice Member" })
      .waitFor();
    assert(await aliceRole.isDisabled());
    assert(await bobRole.isDisabled());
    assert((await aliceRole.textContent()).includes("Member"));
    await scan(aliceRole.locator(".."), "role-pending");
    await shot("role-pending");
    releaseRole();
    const retry = page.getByRole("button", {
      name: "Retry changing team role for Alice Member to Admin",
      exact: true,
    });
    await retry.waitFor();
    assert.equal(roleCount, 1);
    await scan(aliceRole.locator(".."), "role-error");
    await shot("role-error");
    await retry.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Team role for Alice Member"]')
          ?.textContent.includes("Admin") &&
        !document.querySelector('[aria-label="Team role for Alice Member"]')
          ?.disabled,
    );
    assert.equal(roleCount, 2);
    assert.equal(await page.getByRole("alert").count(), 0);
    await scan(aliceRole.locator(".."), "role-confirmed");
    await page
      .getByRole("button", { name: "Actions for Alice Member", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Remove Member", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Remove Member",
      exact: true,
    });
    // Open through reachable native controls, then verify a short dialog after resizing.
    // The known short member-list scrolling inventory remains checkpoint 4.
    await page.setViewportSize({ width: config.width, height: config.height });
    await settle();
    await footerReachable(dialog);
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
    await removalHeld.promise;
    assert(
      await dialog
        .getByRole("button", { name: "Cancel", exact: true })
        .isDisabled(),
    );
    assert(
      await dialog
        .getByRole("button", { name: "Close", exact: true })
        .isDisabled(),
    );
    assert(
      await dialog
        .getByRole("button", { name: "Removing...", exact: true })
        .isDisabled(),
    );
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    assert(await dialog.isVisible());
    assert.equal(removeCount, 1);
    await scan(dialog, "removal-pending");
    await shot("removal-pending");
    releaseRemoval();
    await dialog.getByRole("alert").waitFor();
    await footerReachable(dialog);
    const details = dialog.getByRole("region", {
      name: "Removal details",
      exact: true,
    });
    await details.focus();
    for (let index = 0; index < 4; index++)
      await page.keyboard.press("PageDown");
    if (config.height === 320)
      assert(await details.evaluate((el) => el.scrollTop > 0));
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press("Tab");
      assert(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      );
    }
    await scan(dialog, "removal-error");
    await shot("removal-error");
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(removeCount, 2);
    assert.equal(
      await page
        .getByRole("combobox", {
          name: "Team role for Alice Member",
          exact: true,
        })
        .count(),
      0,
    );
    assert.deepEqual(
      writes.map((write) => write.method),
      ["PATCH", "PATCH", "DELETE", "DELETE"],
    );
    outcomes.push({
      state: name,
      roleRequests: roleCount,
      removalRequests: removeCount,
      exactRetries: true,
      locksAndConfirmedState: true,
      shortFooterReachable: true,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      mockedWritesOnly: true,
      outcomes,
      scans,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

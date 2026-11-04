// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-profile-navigation.mjs <temporary Playwright + @axe-core/playwright installation>
// All HTTP APIs are mocked; no real account, role or membership is changed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
if (!process.argv[2])
  throw new Error("Pass the temporary browser-test installation directory.");
const require = createRequire(resolve(process.argv[2], "package.json"));
const { chromium } = require("playwright"),
  { default: AxeBuilder } = require("@axe-core/playwright");
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
  const date = "2026-11-05T00:00:00Z";
  const peer = {
    id: "peer",
    firstName: "Peer",
    lastName: "Person",
    email: "peer@example.test",
    role: "USER",
  };
  const privileged = {
    ...peer,
    id: "privileged",
    firstName: "Privileged",
    role: "SUPER_ADMIN",
  };
  const paged = (content) => ({
    content,
    page: 0,
    size: 10,
    totalPages: content.length ? 1 : 0,
    totalElements: content.length,
    last: true,
  });
  async function scenario({
    role = "USER",
    archived = false,
    teamRole = "MEMBER",
    holdMembership = false,
  } = {}) {
    const viewer = {
      id: "viewer",
      firstName: "Viewer",
      lastName: "Person",
      email: "viewer@example.test",
      role,
    };
    const team = {
      key: "TEAM",
      name: "Customer delivery",
      description: "Coordinate the launch.",
      owner: viewer,
      createdBy: viewer,
      createdAt: date,
      updatedAt: date,
      lastActivityAt: date,
      deletedAt: archived ? date : null,
    };
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "HS256" })}.${encode({ sub: viewer.email, userId: viewer.id, role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock`;
    const state = {
      denied: 0,
      holdProfile: false,
      releaseProfile: undefined,
      profileRequestHeld: Promise.withResolvers(),
      releaseMembership: undefined,
    };
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const isGlobal = role === "ADMIN" || role === "SUPER_ADMIN";
    await context.route(`${base}/api/**`, async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname;
      if (path === "/api/auth/refresh")
        return route.fulfill({
          json: {
            token,
            expiresInSeconds: 900,
            user: { ...viewer, userId: viewer.id },
          },
        });
      if (req.method() !== "GET") {
        writes.push({ path, method: req.method() });
        return route.fulfill({
          status: 500,
          json: { message: "Unexpected write" },
        });
      }
      if (path === "/api/users/me") return route.fulfill({ json: viewer });
      if (path === "/api/users")
        return route.fulfill(
          isGlobal
            ? { json: paged([viewer, peer, privileged]) }
            : { status: 403, json: { message: "Forbidden" } },
        );
      if (path.startsWith("/api/users/")) {
        const subject = path.endsWith("/viewer")
          ? viewer
          : path.endsWith("/privileged")
            ? privileged
            : peer;
        if (state.holdProfile)
          await new Promise((done) => {
            state.releaseProfile = done;
            state.profileRequestHeld.resolve();
          });
        const allowed =
          subject.id === viewer.id ||
          isGlobal ||
          (!archived && teamRole && subject.id === peer.id);
        if (state.denied || !allowed)
          return route.fulfill({
            status: state.denied || 404,
            json: { message: "User not found" },
          });
        const { role: globalRole, ...identity } = subject;
        return route.fulfill({
          json:
            subject.id === viewer.id || isGlobal
              ? { ...identity, role: globalRole }
              : identity,
        });
      }
      if (path === "/api/teams/TEAM") return route.fulfill({ json: team });
      if (path === "/api/teams/TEAM/me") {
        if (holdMembership)
          await new Promise((done) => {
            state.releaseMembership = done;
          });
        return route.fulfill({ json: { userId: viewer.id, role: teamRole } });
      }
      if (path.endsWith("/members"))
        return route.fulfill({
          json: paged([
            {
              ...viewer,
              teamRole: teamRole ?? "MEMBER",
              globalRole: viewer.role,
              joinedAt: date,
            },
            {
              id: peer.id,
              firstName: peer.firstName,
              lastName: peer.lastName,
              email: peer.email,
              teamRole: "MEMBER",
              ...(isGlobal ? { globalRole: peer.role } : {}),
              joinedAt: date,
            },
          ]),
        });
      if (path === "/api/teams") {
        if (state.denied && url.searchParams.get("memberId") === peer.id)
          return route.fulfill({
            status: 404,
            json: { message: "User not found" },
          });
        return route.fulfill({
          json: paged(
            archived && url.searchParams.get("deletedFilter") !== "DELETED"
              ? []
              : [team],
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
    return { page, context, state };
  }
  async function settle(page) {
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
  async function shot(page, name) {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(process.env.TTM_TEST_SCREENSHOTS, name),
      });
  }
  async function scan(page, selector, state) {
    await settle(page);
    const result = await new AxeBuilder({ page })
      .include(selector)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }));
    scans.push({ state, scope: selector, violations });
    assert.deepEqual(violations, [], state);
  }
  const link = (page, name) =>
    page.getByRole("link", { name: `View profile for ${name}`, exact: true });
  const linkScope = 'a[aria-label^="View profile for "]';
  const admin = await scenario({ role: "ADMIN", teamRole: null });
  await admin.page.goto(base + "/users");
  await link(admin.page, "Peer Person").waitFor();
  await scan(admin.page, linkScope, "directory-name-links");
  await shot(admin.page, "directory-profile-links.png");
  assert.equal(
    await link(admin.page, "Privileged Person").getAttribute("href"),
    "/users/privileged",
  );
  assert.equal(
    await admin.page
      .getByRole("button", {
        name: "Actions for Privileged Person",
        exact: true,
      })
      .count(),
    0,
  );
  const peerRow = admin.page.getByRole("row").filter({ hasText: peer.email });
  await peerRow
    .getByRole("button", { name: "Actions for Peer Person", exact: true })
    .click();
  await admin.page
    .getByRole("menuitem", { name: "Edit User", exact: true })
    .click();
  const edit = admin.page.getByRole("dialog", {
    name: "Edit user",
    exact: true,
  });
  await edit.waitFor();
  assert.equal(new URL(admin.page.url()).pathname, "/users");
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  await edit.waitFor({ state: "hidden" });
  await peerRow
    .getByRole("button", { name: "Actions for Peer Person", exact: true })
    .click();
  await admin.page
    .getByRole("menuitem", { name: "Reset password", exact: true })
    .click();
  const reset = admin.page.getByRole("dialog", {
    name: "Reset password",
    exact: true,
  });
  await reset.waitFor();
  assert.equal(new URL(admin.page.url()).pathname, "/users");
  await reset.getByRole("button", { name: "Cancel", exact: true }).click();
  await reset.waitFor({ state: "hidden" });
  const [popup] = await Promise.all([
    admin.context.waitForEvent("page"),
    link(admin.page, "Peer Person").click({ modifiers: ["Control"] }),
  ]);
  popup.on("pageerror", (error) => errors.push(error.message));
  await popup
    .getByRole("heading", { name: "Peer Person", exact: true })
    .waitFor();
  assert.equal(new URL(admin.page.url()).pathname, "/users");
  await popup.close();
  await link(admin.page, "Privileged Person").click();
  await admin.page
    .getByRole("heading", { name: "Privileged Person", exact: true })
    .waitFor();
  assert.equal(
    await admin.page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .count(),
    0,
  );
  await admin.page.goBack();
  await link(admin.page, "Peer Person").click();
  await admin.page
    .getByRole("heading", { name: "Peer Person", exact: true })
    .waitFor();
  await admin.page
    .getByRole("button", { name: "Edit Profile", exact: true })
    .waitFor();
  await admin.page.goBack();
  admin.state.denied = 404;
  await link(admin.page, "Peer Person").click();
  await admin.page
    .getByRole("heading", { name: "Profile unavailable", exact: true })
    .waitFor();
  assert.equal(
    await admin.page.getByText(peer.email, { exact: true }).count(),
    0,
  );
  assert.equal(
    await admin.page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .count(),
    0,
  );
  await scan(admin.page, 'section[role="alert"]', "unavailable-profile");
  await shot(admin.page, "profile-unavailable.png");
  admin.state.denied = 0;
  admin.state.holdProfile = true;
  await admin.page
    .getByRole("button", { name: "Retry profile", exact: true })
    .click();
  const retry = admin.page.getByRole("button", {
    name: "Retrying profile...",
    exact: true,
  });
  await retry.waitFor();
  assert.equal(await retry.isDisabled(), true);
  await admin.state.profileRequestHeld.promise;
  assert.equal(typeof admin.state.releaseProfile, "function");
  admin.state.holdProfile = false;
  admin.state.releaseProfile();
  await admin.page
    .getByRole("heading", { name: "Peer Person", exact: true })
    .waitFor();
  await admin.page.goBack();
  admin.state.denied = 404;
  await link(admin.page, "Peer Person").click();
  await admin.page
    .getByRole("link", { name: "Open workspace", exact: true })
    .click();
  await admin.page.waitForURL("**/teams");
  await admin.context.close();

  const member = await scenario({ holdMembership: true });
  await member.page.goto(base + "/teams/TEAM/members");
  await member.page.getByText("Peer Person", { exact: true }).waitFor();
  assert.equal(await link(member.page, "Peer Person").count(), 0);
  await link(member.page, "Viewer Person").waitFor();
  assert.equal(typeof member.state.releaseMembership, "function");
  member.state.releaseMembership();
  await link(member.page, "Peer Person").waitFor();
  await scan(member.page, linkScope, "active-member-name-links");
  await member.page.setViewportSize({ width: 390, height: 844 });
  await shot(member.page, "active-member-mobile-links.png");
  await link(member.page, "Peer Person").focus();
  await member.page.keyboard.press("Enter");
  await member.page.waitForURL("**/users/peer");
  await member.page
    .getByRole("heading", { name: "Peer Person", exact: true })
    .waitFor();
  assert.equal(
    await member.page.getByText("Global Access", { exact: true }).count(),
    0,
  );
  assert.equal(
    await member.page
      .getByRole("button", { name: "Edit Profile", exact: true })
      .count(),
    0,
  );
  const header = member.page.locator("header").filter({
    has: member.page.getByRole("heading", {
      name: "Peer Person",
      exact: true,
    }),
  });
  await header.evaluate((el) => {
    el.id = "profile-header-probe";
  });
  await scan(member.page, "#profile-header-probe", "limited-teammate-profile");
  await shot(member.page, "limited-teammate-profile-mobile.png");
  await member.context.close();

  const archived = await scenario({ archived: true, teamRole: "OWNER" });
  await archived.page.goto(base + "/teams/TEAM/members");
  await archived.page.getByText("Peer Person", { exact: true }).waitFor();
  assert.equal(await link(archived.page, "Peer Person").count(), 0);
  await link(archived.page, "Viewer Person").waitFor();
  await scan(archived.page, linkScope, "archived-ordinary-view-self-link");
  await shot(archived.page, "archived-peer-plain-name.png");
  await link(archived.page, "Viewer Person").click();
  await archived.page
    .getByRole("heading", { name: "Viewer Person", exact: true })
    .waitFor();
  await archived.context.close();

  const global = await scenario({
    role: "ADMIN",
    archived: true,
    teamRole: null,
  });
  await global.page.goto(base + "/teams/TEAM/members");
  await link(global.page, "Peer Person").waitFor();
  await global.page.evaluate(() =>
    document.documentElement.classList.add("dark"),
  );
  await scan(global.page, linkScope, "archived-global-admin-links-dark");
  await shot(global.page, "archived-admin-profile-links-dark.png");
  await link(global.page, "Peer Person").focus();
  await global.page.keyboard.press("Enter");
  await global.page
    .getByRole("heading", { name: "Peer Person", exact: true })
    .waitFor();
  await global.context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      directoryAndMemberEntryPoints: true,
      keyboardAndModifiedClick: true,
      administrationActionsSeparate: true,
      confirmedActiveMembershipRequired: true,
      archivedOrdinaryPeersPlain: true,
      archivedGlobalProfilesLinked: true,
      limitedProfilesRemainReadOnly: true,
      unavailableAndRetryFeedback: true,
      mutations: writes.length,
      scans,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

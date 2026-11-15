// Start Vite at 127.0.0.1:4187 with VITE_API_URL=http://127.0.0.1:4187.
// Usage: node scripts/check-account-feedback.mjs <temporary Playwright + @axe-core/playwright installation>
// Every API is mocked; no real account or credential is changed.
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
  let profile = {
      id: "account",
      firstName: "Test",
      lastName: "Person",
      email: "test@example.test",
      role: "USER",
    },
    signedIn = false,
    release,
    arrive;
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const auth = () => ({
    token: `${encode({ alg: "HS256" })}.${encode({ sub: profile.email, userId: profile.id, role: profile.role, exp: Math.floor(Date.now() / 1000) + 900 })}.mock`,
    expiresInSeconds: 900,
    user: { ...profile, userId: profile.id },
  });
  const paged = {
    content: [],
    page: 0,
    size: 20,
    totalPages: 0,
    totalElements: 0,
    last: true,
  };
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route(`${base}/api/**`, async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path === "/api/auth/refresh")
      return route.fulfill(
        signedIn
          ? { json: auth() }
          : {
              status: 401,
              json: {
                error: "INVALID_CREDENTIALS",
                message: "Invalid Credentials",
              },
            },
      );
    if (path === "/api/auth/logout") {
      signedIn = false;
      return route.fulfill({ status: 204 });
    }
    const credential = path.endsWith("/email") || path.endsWith("/password");
    if (
      (request.method() === "POST" &&
        ["/api/auth/login", "/api/auth/register"].includes(path)) ||
      (request.method() === "PATCH" && credential)
    ) {
      const body = request.postDataJSON();
      writes.push({ path, body });
      const result = await new Promise((done) => {
        release = done;
        arrive();
      });
      if (result.abort) return route.abort("failed");
      if (result.status) return route.fulfill(result);
      if (credential) {
        if (body.newEmail) profile = { ...profile, email: body.newEmail };
        return route.fulfill({ status: 204 });
      }
      if (path.endsWith("register"))
        profile = {
          ...profile,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
        };
      signedIn = true;
      return route.fulfill({ json: auth() });
    }
    if (path === "/api/users/me") return route.fulfill({ json: profile });
    if (path === "/api/notifications/unread-count")
      return route.fulfill({ json: { unreadCount: 0 } });
    return route.fulfill({ json: paged });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  async function waitWrite(action) {
    let timer;
    const seen = new Promise((yes, no) => {
      timer = setTimeout(
        () => no(new Error("Account request did not arrive")),
        10000,
      );
      arrive = () => {
        clearTimeout(timer);
        yes();
      };
    });
    try {
      await Promise.all([seen, action()]);
    } finally {
      clearTimeout(timer);
    }
  }
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
  async function shot(name) {
    if (process.env.TTM_TEST_SCREENSHOTS)
      await page.screenshot({
        path: resolve(process.env.TTM_TEST_SCREENSHOTS, name),
      });
  }
  async function scan(selector, state) {
    await settle();
    const result = await new AxeBuilder({ page })
      .include(selector)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }));
    scans.push({ state, violations });
    assert.deepEqual(violations, [], state);
  }
  async function tabBounds() {
    await settle();
    assert.equal(
      await page.getByRole("tablist").getAttribute("aria-orientation"),
      "vertical",
    );
    const nav = await page.getByRole("tablist").boundingBox(),
      panel = await page.getByRole("tabpanel").boundingBox();
    if (page.viewportSize().width < 1024)
      assert.ok(
        panel.y >= nav.y + nav.height,
        "tabs must not overlap the active panel",
      );
    else
      assert.ok(
        panel.x >= nav.x + nav.width,
        "desktop tabs must stay beside the active panel",
      );
  }
  async function visibleAlert(text) {
    const alert = page.getByRole("alert").filter({ hasText: text });
    await alert.waitFor();
    await settle();
    const b = await alert.boundingBox();
    assert.ok(
      b.y >= 0 && b.y + b.height <= page.viewportSize().height,
      JSON.stringify(b),
    );
    return alert;
  }
  const loginPassword = () => page.getByLabel(/^Password/);
  await page.goto(base + "/login");
  await page.getByLabel(/^Email/).fill(profile.email);
  await loginPassword().fill(" old ");
  await waitWrite(() =>
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  );
  assert.equal(await loginPassword().isDisabled(), true);
  assert.equal(
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .isDisabled(),
    true,
  );
  release({ status: 503, json: { message: "Internal diagnostic details" } });
  await visibleAlert("The service is temporarily unavailable");
  assert.equal(await loginPassword().inputValue(), " old ");
  await scan("main", "login-service-error");
  await shot("login-service-error-mobile.png");
  await waitWrite(() =>
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  );
  release({
    status: 401,
    json: { error: "INVALID_CREDENTIALS", message: "Invalid Credentials" },
  });
  await visibleAlert("Email or password is incorrect");
  await scan("main", "login-credential-error");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  assert.equal(await loginPassword().inputValue(), "");
  assert.equal(await page.getByLabel(/^Email/).inputValue(), profile.email);
  await page.getByLabel(/^First name/).fill("Éva-Marie");
  await page.getByLabel(/^Last name/).fill("O'Neil");
  await page.getByLabel(/^Email/).fill("new@example.test");
  await loginPassword().fill("simple");
  await page.getByLabel(/^Confirm password/).fill("different");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByText("Password does not meet the requirements", { exact: true })
    .waitFor();
  assert.equal(writes.length, 2);
  assert.equal(await loginPassword().getAttribute("aria-invalid"), "true");
  await scan("main", "registration-validation");
  await shot("registration-validation-mobile.png");
  await loginPassword().fill("Strong123!");
  await page.getByLabel(/^Confirm password/).fill("Strong123!");
  await page
    .getByRole("button", { name: "Show confirmation password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel(/^Confirm password/).getAttribute("type"),
    "text",
  );
  await waitWrite(() =>
    page.getByRole("button", { name: "Create account", exact: true }).click(),
  );
  release({ abort: true });
  await visibleAlert("Could not confirm registration");
  assert.equal(await loginPassword().inputValue(), "Strong123!");
  await scan("main", "registration-uncertain");
  await shot("registration-uncertain-mobile.png");
  await waitWrite(() =>
    page.getByRole("button", { name: "Create account", exact: true }).click(),
  );
  release({});
  await page.waitForURL("**/teams");
  assert.deepEqual(writes[2].body, writes[3].body);
  await page.goto(base + "/settings");
  await page.getByLabel("New email", { exact: true }).waitFor();
  await tabBounds();
  const peer = await context.newPage();
  peer.on("pageerror", (error) => errors.push(error.message));
  await peer.goto(base + "/settings");
  await peer
    .getByLabel("Current password", { exact: true })
    .fill("Peer draft to clear");
  await page.setViewportSize({ width: 390, height: 500 });
  await tabBounds();
  await page.getByLabel("New email", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Update email", exact: true }).click();
  await page
    .getByText("Current password is required", { exact: true })
    .waitFor();
  await scan('form[aria-label="Change login email"]', "email-validation");
  await page
    .getByLabel("New email", { exact: true })
    .fill("changed@example.test");
  await page.getByLabel("Current password", { exact: true }).fill("Strong123!");
  await waitWrite(() =>
    page.getByRole("button", { name: "Update email", exact: true }).click(),
  );
  for (const tab of await page.getByRole("tab").all())
    assert.equal(await tab.isDisabled(), true);
  assert.equal(
    await page.getByLabel("New email", { exact: true }).isDisabled(),
    true,
  );
  release({ status: 400, json: { message: "Current password incorrect" } });
  await visibleAlert("Current password incorrect");
  assert.equal(
    await page.getByLabel("Current password", { exact: true }).inputValue(),
    "Strong123!",
  );
  await scan('form[aria-label="Change login email"]', "email-rejected");
  await shot("email-error-short.png");
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  assert.equal(
    await page.getByLabel("Current password", { exact: true }).inputValue(),
    "",
  );
  await page.getByLabel("Current password", { exact: true }).fill("Strong123!");
  await page.getByLabel("New password", { exact: true }).fill("Strong456!");
  await page.getByLabel("Confirm password", { exact: true }).fill("mismatch");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await page.getByText("Passwords do not match", { exact: true }).waitFor();
  await scan('form[aria-label="Change password"]', "password-validation");
  await page.getByLabel("Confirm password", { exact: true }).fill("Strong456!");
  await waitWrite(() =>
    page.getByRole("button", { name: "Update password", exact: true }).click(),
  );
  release({ status: 503, json: { message: "Internal diagnostic details" } });
  await visibleAlert("The service is temporarily unavailable");
  assert.equal(
    await page.getByLabel("New password", { exact: true }).inputValue(),
    "Strong456!",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await scan(
    'form[aria-label="Change password"]',
    "password-service-error-dark",
  );
  await shot("password-error-desktop-dark.png");
  await page.getByRole("tab", { name: "Preferences", exact: true }).click();
  await page.getByRole("button", { name: /^Light/ }).click();
  assert.equal(
    await page
      .getByRole("button", { name: /^Light/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("status")
    .filter({ hasText: "Preference saved" })
    .waitFor();
  await scan('[role="tabpanel"][data-state="active"]', "preferences-feedback");
  await page.getByRole("tab", { name: "Account", exact: true }).click();
  assert.equal(
    await page.getByLabel("New email", { exact: true }).inputValue(),
    "changed@example.test",
  );
  assert.equal(
    await page.getByLabel("Current password", { exact: true }).inputValue(),
    "",
  );
  await page.getByLabel("Current password", { exact: true }).fill("Strong123!");
  await waitWrite(() =>
    page.getByRole("button", { name: "Update email", exact: true }).click(),
  );
  release({});
  await page.waitForURL("**/login");
  await peer.waitForURL("**/login");
  await peer.getByLabel(/^Password/).waitFor();
  assert.equal(await peer.getByLabel(/^Password/).inputValue(), "");
  await page.getByLabel(/^Email/).fill("changed@example.test");
  await loginPassword().fill("Strong123!");
  await waitWrite(() =>
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  );
  release({});
  await page.waitForURL("**/teams");
  await page.goto(base + "/settings");
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  assert.equal(
    await page.getByLabel("New password", { exact: true }).inputValue(),
    "",
  );
  await page.getByLabel("Current password", { exact: true }).fill("Strong123!");
  await page.getByLabel("New password", { exact: true }).fill("Strong456!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Strong456!");
  await waitWrite(() =>
    page.getByRole("button", { name: "Update password", exact: true }).click(),
  );
  release({});
  await page.waitForURL("**/login");
  await peer.waitForURL("**/login");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: "Edge",
      mobileAndShortViewport: true,
      settingsTabOrientationAndBounds: true,
      distinctLoginFailures: true,
      registrationValidationAndUncertainty: true,
      pendingFieldsAndSwitchesLocked: true,
      passwordDraftsRetainedAndClearedOnSwitch: true,
      credentialSuccessSignsOutBothTabs: true,
      writeRequests: writes.length,
      scans,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}

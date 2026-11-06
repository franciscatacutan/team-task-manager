// Actual isolated stack, generated accounts only; no API interception or persistent browser trust.
// Usage: TTM_LOCAL_NAME=<initialized rehearsal> node scripts/check-local-deployment.mjs <temporary Playwright directory>
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { connect } from "node:tls";
import { createHash, X509Certificate, randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("../../", import.meta.url));
const name = process.env.TTM_LOCAL_NAME;
assert.match(name ?? "", /^[a-z][a-z0-9-]{0,30}$/);
const state = resolve(root, "deploy/local/state", name);
const settings = Object.fromEntries(
  readFileSync(resolve(state, "environment.env"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
assert.equal(settings.TTM_OWNER, "isolated-local-v1");
assert.equal(settings.TTM_PROJECT, `ttm-local-${name}`);
assert.equal(settings.BIND_ADDRESS, "127.0.0.1");
const base = settings.PUBLIC_ORIGIN;
assert.equal(new URL(base).hostname, "localhost");
const development = settings.MODE === "Dev";
assert.equal(new URL(base).protocol, development ? "http:" : "https:");
const ca = development ? undefined : readFileSync(resolve(state, "root.crt"));
const request = development ? httpRequest : httpsRequest;

function call(
  path,
  { method = "GET", body, token, cookie, origin = base, trusted = true } = {},
) {
  return new Promise((resolveResponse, reject) => {
    const headers = { Origin: origin };
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    const req = request(
      base + path,
      { method, headers, ...(trusted ? { ca } : {}), timeout: 15000 },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            /* HTML is allowed only in explicit page checks. */
          }
          resolveResponse({
            status: res.statusCode,
            headers: res.headers,
            json,
            text,
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Local request timed out")));
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

let pin;
if (development) {
  assert.equal(
    (await call("/api/auth/refresh", { method: "POST" })).status,
    401,
  );
} else {
  assert.equal((await call("/healthz")).json.status, "UP");
  await assert.rejects(call("/healthz", { trusted: false }));
  pin = await new Promise((resolvePin, reject) => {
    const socket = connect(
      {
        host: "localhost",
        port: Number(settings.APP_PORT),
        servername: "localhost",
        ca,
      },
      () => {
        assert.equal(socket.authorized, true);
        const publicKey = new X509Certificate(
          socket.getPeerCertificate().raw,
        ).publicKey.export({ type: "spki", format: "der" });
        resolvePin(createHash("sha256").update(publicKey).digest("base64"));
        socket.end();
      },
    );
    socket.on("error", reject);
  });
}

const administrator = await call("/api/auth/login", {
  method: "POST",
  body: {
    email: settings.BOOTSTRAP_ADMIN_EMAIL,
    password: settings.BOOTSTRAP_ADMIN_PASSWORD,
  },
});
assert.equal(administrator.status, 200);
assert.equal(administrator.json.user.role, "SUPER_ADMIN");
const cookie = administrator.headers["set-cookie"][0];
assert.match(cookie, /HttpOnly/i);
assert.equal(/(?:^|;)\s*Secure(?:;|$)/i.test(cookie), !development);
assert.match(cookie, development ? /SameSite=Lax/i : /SameSite=None/i);
assert.match(cookie, /Path=\/api\/auth/i);
const denied = await call("/api/auth/refresh", {
  method: "POST",
  cookie: cookie.split(";")[0],
  origin: "https://untrusted.example.test",
});
assert.equal(denied.status, 403);
assert.equal(denied.headers["set-cookie"], undefined);
const team = await call("/api/teams", {
  method: "POST",
  token: administrator.json.token,
  body: { name: "Local rehearsal " + randomUUID() },
});
assert.equal(team.status, 201);

const accounts = [];
for (const firstName of ["Alice", "Bob"]) {
  const account = {
    email: `${firstName.toLowerCase()}-${randomUUID()}@example.test`,
    firstName,
    lastName: "Local",
    password: `Local1!${randomUUID()}`,
  };
  const registered = await call("/api/auth/register", {
    method: "POST",
    body: { ...account, confirmPassword: account.password },
  });
  assert.equal(registered.status, 201);
  accounts.push({ ...account, id: registered.json.user.userId });
}

assert.ok(
  process.argv[2],
  "Pass a temporary Playwright installation directory",
);
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
  // Trust exactly this ephemeral server key for these browser processes only.
  // Node HTTPS above separately verifies the actual CA chain, hostname, and rejection without CA.
  args: pin ? [`--ignore-certificate-errors-spki-list=${pin}`] : [],
});
const pageErrors = [];
const contexts = [];
try {
  const pages = [];
  for (const account of accounts) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    contexts.push(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (req) =>
      assert.ok(!req.url().includes("undefined/api")),
    );
    await page.goto(base + "/login");
    await page.getByLabel(/^Email/).fill(account.email);
    await page.getByLabel(/^Password/).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("button", {
        name: `Open user menu for ${account.firstName} Local`,
      })
      .waitFor();
    const secure = await page.evaluate(() => ({
      secure: isSecureContext,
      locks: !!navigator.locks?.request,
    }));
    assert.deepEqual(secure, { secure: true, locks: true });
    const refreshCookie = (await context.cookies()).find(
      (item) => item.name === `${settings.TTM_PROJECT}_refresh`,
    );
    assert.equal(refreshCookie.secure, !development);
    assert.equal(refreshCookie.httpOnly, true);
    pages.push(page);
  }
  const sibling = await contexts[0].newPage();
  sibling.on("pageerror", (error) => pageErrors.push(error.message));
  await sibling.goto(base + "/teams");
  await sibling
    .getByRole("button", { name: "Open user menu for Alice Local" })
    .waitFor();
  await Promise.all([pages[0].reload(), sibling.reload()]);
  for (const page of [pages[0], sibling]) {
    await page
      .getByRole("button", { name: "Open user menu for Alice Local" })
      .waitFor();
  }
  await pages[1].reload();
  await pages[1]
    .getByRole("button", { name: "Open user menu for Bob Local" })
    .waitFor();
  if (process.env.TTM_TEST_ARTIFACT_DIR) {
    mkdirSync(process.env.TTM_TEST_ARTIFACT_DIR, { recursive: true });
    await pages[0].screenshot({
      path: resolve(
        process.env.TTM_TEST_ARTIFACT_DIR,
        `${development ? "dev" : "https"}-alice-workspace.png`,
      ),
      fullPage: true,
    });
    await pages[1].screenshot({
      path: resolve(
        process.env.TTM_TEST_ARTIFACT_DIR,
        `${development ? "dev" : "https"}-bob-workspace.png`,
      ),
      fullPage: true,
    });
  }
  await pages[0]
    .getByRole("button", { name: "Open user menu for Alice Local" })
    .click();
  await pages[0].getByRole("menuitem", { name: "Logout", exact: true }).click();
  await pages[0]
    .getByRole("button", { name: "Sign in", exact: true })
    .waitFor();
  await sibling.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  await pages[1].reload();
  await pages[1]
    .getByRole("button", { name: "Open user menu for Bob Local" })
    .waitFor();
  assert.deepEqual(pageErrors, []);
  console.log(
    JSON.stringify({
      mode: settings.MODE,
      actualStack: true,
      trustedLocalCa: development ? null : true,
      rejectedWithoutCa: development ? null : true,
      browserUsesEphemeralKeyPin: !development,
      sameOriginApi: true,
      secureHttpOnlyCookies: !development,
      httpOnlyCookies: true,
      untrustedOriginRejected: true,
      independentBrowserProfiles: true,
      sameProfileTabsSynchronized: true,
      logoutIsolatedAcrossProfiles: true,
      pageErrors,
    }),
  );
} finally {
  await browser.close();
}

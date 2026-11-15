# Pilot onboarding

A team owner or team admin opens **Members → Invite new member**, enters the person's email, and copies the generated link. Share the link with that person through a private channel. It expires after 24 hours and can be used once. Creating another pending invite for the same email and team replaces the earlier link. For someone with an existing account, use **Add members**.

The recipient opens the link while signed out, enters the invited email, and chooses a password. Signup creates a regular account and a **Member** role in the inviting team, then signs them in. If the link is expired or unavailable, the team manager can make a replacement. Use account archive and restore to change whether someone can access the application. [Member handoff and account lifecycle](member-handoff.md)

## Manage pending invites

Open **Members → Pending invites** to see outstanding invites and their expiration times. Select **Revoke** next to an email and confirm to disable the link. If the person still needs an account, issue a new link from **Invite new member**. Accepted and expired invites are excluded from the list. If the person has already joined, manage their access from the member directory.

## Recover an account

1. The user contacts a global administrator. Verify their identity through your team's usual private channel before resetting the password.
2. In **Users**, open the user's actions menu and select **Reset password**. Set and confirm a unique temporary password. A successful reset invalidates the old password and signs that user out of all existing sessions.
3. Share the temporary password privately. Ask the user to sign in and change it in **Settings → Security**. The application does not force a password change at the next sign-in.
4. To recover a `SUPER_ADMIN` account through the app, contact another `SUPER_ADMIN`. Keep a second authorized administrator available for this case.

## Sign-in and signup limits

The pilot defaults to a five-minute window. Sign-in allows eight attempts per email and client IP together, with a total of 60 attempts per IP. Signup has a separate limit of 20 attempts per IP. These limits count requests that pass form validation, including successful requests. When a limit is reached, the API returns HTTP 429 and the form shows how long to wait. Blocked attempts do not extend the window.

Set `auth.rate-limit.window`, `auth.rate-limit.login-per-client`, `auth.rate-limit.login-per-email-and-client`, or `auth.rate-limit.registration-per-client` to adjust the defaults in the [backend configuration](../backend/src/main/resources/application.yaml). Counters are in memory per backend instance and reset when that instance restarts. Before running multiple replicas, verify the rate limits at the shared ingress or use shared counters.

The packaged proxies overwrite `X-TTM-Client-IP` with the connecting client's address. Keep the backend private if you enable `AUTH_TRUST_PROXY_CLIENT_IP`. If a hosting provider puts another proxy in front of the app, verify the final proxy supplies the verified client address so unrelated users don't share one quota.

## Environment and verification

Production and the local HTTPS rehearsal require an invite for signup. The `local` Spring profile keeps open registration for development. The server enforces this policy and serves it to the sign-in form. Bring the application up on the intended profile before testing onboarding. [Local rehearsal](checkpoint-7-local-rehearsal.md)

Flyway V5 adds `team_invitations`. The database stores a hash of the link token. The invite identifies the team and normalized email, and the server rechecks the issuing manager's access before redemption. Account creation, membership, session creation, and invite consumption commit together. The token is carried in the browser link fragment and submitted in the registration request body. [OWASP guidance on single-use URL tokens](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

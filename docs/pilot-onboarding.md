# Pilot onboarding

A team owner or team admin opens **Members → Invite new member**, enters the person's email, and copies the generated link. Share the link with that person through a private channel. It expires after 24 hours and can be used once. Creating another pending invite for the same email and team replaces the earlier link. For someone with an existing account, use **Add members**.

The recipient opens the link while signed out, enters the invited email, and chooses a password. Signup creates a regular account and a **Member** role in the inviting team, then signs them in. If the link is expired or unavailable, the team manager can make a replacement. Account recovery uses the existing administrator reset and archive/restore controls. [Member handoff and account lifecycle](member-handoff.md)

## Environment and verification

Production and the local HTTPS rehearsal require an invite for signup. The `local` Spring profile keeps open registration for development. The server enforces this policy and serves it to the sign-in form. Bring the application up on the intended profile before testing onboarding. [Local rehearsal](checkpoint-7-local-rehearsal.md)

Flyway V5 adds `team_invitations`. The database stores a hash of the link token. The invite identifies the team and normalized email, and the server rechecks the issuing manager's access before redemption. Account creation, membership, session creation, and invite consumption commit together. The token is carried in the browser link fragment and submitted in the registration request body. [OWASP guidance on single-use URL tokens](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

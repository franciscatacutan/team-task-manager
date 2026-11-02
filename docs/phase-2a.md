# Phase 2A: dependencies and formatting

Baseline: `fe0fbd335187d15576125f03c08f793c9b525ec8`. The user approved latest compatible stable releases, required major-version migrations, Prettier plus Spotless/Google Java Format, and a one-time full-codebase formatting pass. Changes are left unstaged and uncommitted for the user.

## Dependency changes

| Area                          | Selected version          | Reason / compatibility                                                                                                                                 |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                       | 24 LTS, minimum 24.15     | Align local engines, `.nvmrc`, CI, Docker, and Node type definitions.                                                                                  |
| React / React DOM             | 19.3.1                    | Latest stable package releases at implementation time.                                                                                                 |
| Vite / React plugin           | 8.3.5 / 6.2.1             | Vite 8's Rolldown/Oxc build pipeline; plugin 6 requires Vite 8.                                                                                        |
| TypeScript                    | 6.0.3                     | Latest stable within typescript-eslint's supported range, below 6.1; do not jump to TypeScript 7 yet.                                                  |
| ESLint / typescript-eslint    | 10.14.0 / 8.72.1          | Compatible major upgrade; retain strict rules and zero-warning CI.                                                                                     |
| React Router                  | 8.5.1                     | Replace the retired `react-router-dom` re-export package with `react-router` imports. Existing declarative routes remain declarative.                  |
| DayPicker                     | `@daypicker/react` 10.0.2 | Preferred package; replace the removed `table` styling key with `month_grid`.                                                                          |
| Lucide React                  | 1.66.0                    | Existing icon imports compile with the new major.                                                                                                      |
| Hook Form resolvers           | 7.0.1                     | Tested with React Hook Form 7.91.0 and Zod 4.6.7.                                                                                                      |
| Spring Boot                   | 4.1.2                     | Latest stable release; do not select the 4.2 release candidate. Keep Java 21 and Boot-managed dependency versions.                                     |
| JJWT                          | 0.13.0                    | Use `SecretKey`, current builder methods, and `parser().verifyWith(...).parseSignedClaims(...).getPayload()`.                                          |
| Bouncy Castle                 | 1.86                      | Update the provider used by the Argon2 password encoder.                                                                                               |
| Prettier                      | 3.9.10, exact pin         | Reproducible formatting with root configuration.                                                                                                       |
| Spotless / Google Java Format | 3.10.4 / 1.36.1           | Released Spotless cannot configure GJF 2's new non-whitespace cleanup pass. Keep 1.36.1 for compatibility and a formatting baseline without that pass. |

Other direct frontend packages were updated to current stable releases. See `frontend/package.json` for allowed versions and `frontend/package-lock.json` for exact resolutions. `add`, `init`, and `dialog` had no source imports and were removed. The shadcn CLI was updated to 4.23.0 and moved to development dependencies; `@tailwindcss/vite` was also moved to development tooling.

## Required source migrations

- Router imports now use `react-router`. No route keys, URL patterns, access rules, or framework mode were redesigned.
- `components/ui/calendar.tsx` uses DayPicker's scoped package and v10 styling key, preserving its local shadcn presentation.
- `vite.config.ts` resolves the source alias with `node:url` and `import.meta.url`; the Vitest config imports `vite.config.ts` with its extension for native ESM compatibility.
- `EditableField.tsx` synchronizes a changed server value using React's conditional render-time state adjustment. This replaces the effect rejected by the upgraded hook rules and preserves the prior save/cancel/refresh behavior.
- `JwtService.java` uses current signing and verification APIs. Issuer, subject, user ID, role, expiry, and secret handling stay consistent with the existing token contract.
- The integration-test base explicitly selects the application configuration, avoiding Spring's warning about future default test-configuration discovery. PostgreSQL remains a disposable test container.
- The remaining source diff is the approved formatting baseline: indentation, wrapping, punctuation, Java import ordering, and whitespace. Domain names remain `name`.

## Formatting and customization

From `frontend`, `npm run format` formats supported files across the repository, including root docs, workflows, JSON, YAML, CSS, HTML, TS and TSX. `npm run format:check` checks the same scope. `.prettierignore` excludes dependency/build output, generated npm lockfiles, environment files, and Maven wrapper scripts. No third-party formatter plugin is needed.

`.prettierrc.json` controls semicolons, quotes, indentation, trailing commas and LF endings. `eslint-config-prettier` disables conflicting stylistic lint rules while preserving code-quality checks. `.editorconfig` supplies editor defaults; `.gitattributes` keeps text LF on checkout, with CRLF for Windows command scripts.

From `backend`, run `.\mvnw.cmd -B -ntp spotless:apply` to format Java and the POM, or `spotless:check` to check them. Linux/macOS uses `bash ./mvnw`. Google Java Format's version/style and Spotless's execution are configured in `backend/pom.xml`; Maven `validate` checks formatting, so `verify` also enforces it.

CI now runs on every pushed branch and PRs targeting main/develop. It checks formatting, tests, strict lint, compilation and both Docker builds. Action versions are checkout v7, setup-java v6 and setup-node v7, with repository contents read permission only. No workflow stages, commits, or pushes source changes.

## Dependency audit snapshot

The original Phase 1 audit reported 36 findings: 1 critical, 23 high, 10 moderate and 2 low. After this phase:

- `npm audit --omit=dev`: **0 findings**.
- `npm audit`: **18 findings: 0 critical, 0 high, 16 moderate, 2 low**, all in development-tool chains. These are package-level counts, not 18 distinct vulnerabilities.
- `minimatch` 10.2.6 is pulled by ESLint, TypeScript ESLint and shadcn's ts-morph chain; advisory `GHSA-g3hv-75wg-m249` is fixed in 11.0.1+, beyond their declared major range.
- shadcn and its registry use `deepmerge` 4.3.1; `GHSA-gcqx-w48m-w2h4` has no patched stable release at implementation time.
- Do not use `npm audit fix --force`: its proposed downgrades do not establish a compatible, secure toolchain. No cross-major transitive overrides were imposed. Recheck upstream fixes as part of maintenance.

The npm audit does not scan Java dependencies, Docker base images, or application logic. Zero production npm findings does not establish overall production readiness.

## Verification

- Reproducible `npm ci` without force or legacy peer resolution.
- Frontend: 17 tests, strict lint, TypeScript/production build, Prettier check.
- Backend: 34 tests, Spotless check, compilation and executable JAR packaging. Tests exercise actual PostgreSQL persistence and HTTP authorization; additional JWT tests cover valid claims, identity mismatch, wrong signing keys, wrong issuers and expired tokens.
- Frontend regression additions cover calendar selection/disabled dates/month navigation, task-form validation, editor synchronization/cancel, and route guard redirects/key-based URL parameters.
- Docker builds verify the backend with Java 21 and the frontend with Node 24. Local backend checks use JDK 25 with Java 21 compilation target.

The frontend retains a roughly 1.06 MB minified JavaScript entry chunk (about 308 KB gzip) and Vite's existing bundle-size warning. Route splitting, asset optimization, database migrations, module restructuring and UI redesign remain separate phases requiring approval. No development database reset or schema migration is included here.

## References

- [Vite migration guide](https://vite.dev/guide/migration.html)
- [React Router v8 migration](https://reactrouter.com/upgrading/v7)
- [DayPicker v10 migration](https://daypicker.dev/upgrading)
- [Supported TypeScript versions](https://typescript-eslint.io/users/dependency-versions/)
- [Prettier installation and exact pinning](https://prettier.io/docs/install.html)
- [Spotless Maven configuration](https://github.com/diffplug/spotless/tree/main/plugin-maven)
- [Google Java Format releases](https://github.com/google/google-java-format/releases)
- [Spring Boot upgrading](https://docs.spring.io/spring-boot/upgrading.html)
- [JJWT signing and verification](https://github.com/jwtk/jjwt)

# Environment variable setup and deployment audit

This inventory was checked against direct source references, scripts, `.env.example`, the `nova-commerce` Vercel project settings, and the deployed build configuration on 2026-11-13. It records names and whether values are present/blank only; secret values were not read. **No Vercel environment variables were changed.**

## Setup checklist

- [ ] Set `DATABASE_URL` for every environment that builds/runs against a database. Use a Neon pooled PostgreSQL URL for Vercel and keep it server-side/encrypted.
- [ ] Before a first seed on an empty database only, set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (12+ characters). The seed script does not reset an existing admin password.
- [ ] Configure all three of `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` to enable production OTP verification, password recovery, and transactional email. Use the email provider's app password/API credential, not an account password.
- [ ] Configure all four S3 settings (`AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`) if admin uploads should work. Otherwise uploads are unavailable; there is no local filesystem fallback on Vercel.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the canonical public storefront origin for production. It is deliberately public and must contain no credentials or private paths.
- [ ] Resolve environment/database isolation before deploying schema changes: **the inspected preview and production environments currently share a database**. Every normal Vercel build runs `scripts/deploy-db.mjs` (migrate, seed, settings sync), except Vercel development or when `DEPLOY_DB=0`. A preview build can therefore mutate the shared production database. Prefer a separate preview database; alternatively establish a deliberate migration/build policy before setting a branch-scoped `DEPLOY_DB=0` (which also means that environment will not apply migrations).
- [ ] Redeploy after changing Vercel variables; environment edits do not alter already-built deployments.

## Exact application and script variables

| Name | Purpose / source | Requirement and default | Value type / public? | Where to set |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection for runtime queries and migration/seed/sync scripts (`src/lib/db.js`, `scripts/*.mjs`). | **Required** for a working deployment and for normal `npm run build` (unless DB deploy is deliberately skipped). | Secret; server-side only. | Vercel Production; Preview only with an isolated preview DB (current preview shares production DB); Development for remote/local DB workflows. |
| `ADMIN_EMAIL` | Initial owner seed and standalone admin-password script (`scripts/seed.mjs`, `scripts/set-admin-password.mjs`). | Needed only when seeding a database with no admin, and for the standalone password script. | Account identifier; not a password, server/build-time only. | Set only in the environment running that first seed or maintenance script. Avoid broad scopes unless intentional. |
| `ADMIN_PASSWORD` | Initial owner seed and standalone admin-password script. | Needed only for a first admin seed; minimum 12 characters. Not used to authenticate normal logins after seeding. | Secret; server/build-time only. | Same limited scope as `ADMIN_EMAIL`; never expose with a `NEXT_PUBLIC_` prefix. |
| `SMTP_HOST` | SMTP server hostname (`src/lib/email.js`). | Part of the required SMTP trio; no default. | Hostname; server-side, non-secret. | Vercel production and any preview/dev environment where email flows are to be tested. |
| `SMTP_PORT` | SMTP server port; enables TLS when set to `465`. | Optional; defaults to `587`. | Port; server-side, non-secret. | Same environments as SMTP. |
| `SMTP_USER` | SMTP authentication username. | Part of the required SMTP trio; no default. | Usually an email address; server-side. Treat as sensitive account information. | Same environments as SMTP. |
| `SMTP_PASS` | SMTP authentication credential for the legacy environment-based transport. | Required only when no encrypted owner-managed SMTP configuration is saved. | Secret; encrypted/sensitive. | Same environments as SMTP. |
| `SMTP_CREDENTIALS_KEY` | Dedicated AES-256-GCM key to encrypt owner-managed SMTP credentials at rest (`src/lib/smtp-settings.js`). | Required to save SMTP credentials in Admin → Email Configuration; 32 raw bytes encoded as base64 or 64 hex characters. | Secret; never `NEXT_PUBLIC_`; use a separately generated key, not the SMTP password. | Vercel Production and any Preview/Development environment where owner-managed SMTP settings are used. |
| `MAIL_FROM_NAME` | Default sender display name for templates (`src/lib/email.js`). | Optional; defaults to `NOVA`; DB email settings can override. | Public-facing label; server-side. | Any environment sending email. |
| `MAIL_FROM_EMAIL` | Fallback sender address; DB email settings can override it. | Optional; fallback is `SMTP_USER`. Must be permitted by the SMTP provider. | Public-facing address; server-side. | Any environment sending email. |
| `ORDER_NOTIFICATION_EMAIL` | Admin order notifications and fallback contact recipient. | Optional; contact API falls back to the configured store email. Checkout admin notification is sent only when this is set and notifications are enabled in store settings. | Email address; server-side, non-secret. | Environments that should receive order/contact notifications. |
| `AWS_ENDPOINT_URL_S3` | S3-compatible storage endpoint (`src/lib/storage.js`). | Required together with access key, secret key, and bucket to enable uploads. | URL; server-side, non-secret. | Vercel environments that use uploads. |
| `AWS_ACCESS_KEY_ID` | S3-compatible storage authentication. | Required as part of the four-variable storage set. | Credential identifier; sensitive/server-side. | Same as S3 endpoint. |
| `AWS_SECRET_ACCESS_KEY` | S3-compatible storage authentication. | Required as part of the four-variable storage set. | Secret; encrypted/sensitive. | Same as S3 endpoint. |
| `AWS_REGION` | S3 request signing region. | Optional; defaults to `us-east-2`. | Region; server-side, non-secret. | Same as S3 endpoint. |
| `S3_BUCKET` | Bucket name used to build public object URLs. | Required as part of the four-variable storage set. | Bucket identifier; server-side, non-secret. | Same as S3 endpoint. |
| `NEXT_PUBLIC_SITE_URL` | Canonical metadata base, structured-data URLs, sitemap/robots origin, and email links. | Optional in code (fallback uses `VERCEL_URL`, then the built-in store URL); set explicitly to the canonical HTTPS storefront domain in production. | **Public** and compiled/used for public output; never put secrets in it. | Vercel production. Preview can intentionally use the production canonical URL to avoid indexable preview duplicates, but ensure this is the desired SEO policy. |
| `EXCHANGE_RATE_API` | Base endpoint used by automatic exchange-rate refresh (`src/lib/currency.js`); code appends `/PKR`. | Optional; defaults to `https://open.er-api.com/v6/latest`. | URL; server-side, non-secret. | Only if replacing the default provider. Not needed just to display configured currencies. |
| `DEPLOY_DB` | Build script switch (`scripts/deploy-db.mjs`). | Optional; `0` skips migrations, seed, and settings sync. Any other/unset value runs them when `DATABASE_URL` exists. Vercel `development` skips regardless. | Boolean-like; non-secret. | Prefer an explicit, carefully scoped Preview value only as part of a documented migration strategy. Do not set globally to `0` if production builds must deploy schema. |
| `PGLITE_PORT` | Port for the local PGlite development server (`scripts/_pgl.mjs`). | Local tooling only; defaults to `55432`. | Port; non-secret. | Local development only; not Vercel. |

### Platform-provided values (do not manually add)

| Name | Use | Requirement / scope |
|---|---|---|
| `NODE_ENV` | Secure-cookie behavior and development-only OTP fallback. | Set by Next.js/platform (`production` for production builds); do not override in Vercel. |
| `VERCEL_ENV` | Lets `scripts/deploy-db.mjs` skip automatic DB deploy for Vercel development. | Vercel-provided (`production`, `preview`, or `development`); do not create manually. |
| `VERCEL_URL` | Fallback origin for canonical metadata, sitemap and robots when `NEXT_PUBLIC_SITE_URL` is absent. | Vercel-provided hostname; use HTTPS in app URL construction; do not create manually. |

## Obsolete / not used

- `AUTH_SECRET` appears in the old `.env.example`, README deployment checklist, ignored local environment, and Vercel project variable list, but a source/script scan found **no code reads it**. The current cookie-session implementation uses random tokens stored as hashes in the database; it does not depend on `AUTH_SECRET`. It is not required. The example and README have been corrected; the existing Vercel variable has **not** been changed because environment management is yours.
- No `STRIPE_*`, `PAYPAL_*`, or other online processor key is used by this code. Checkout currently supports store-configured offline/manual methods (COD, bank transfer, Easypaisa, JazzCash); do not add payment secrets expecting a gateway integration to work.
- No separate backend-hosting environment is evident in this repository: Next.js route handlers and server-side application logic run on Vercel, PostgreSQL is external (Neon), and object storage is external (Neon S3-compatible storage). `PGLITE_PORT` is for local development only.

## Vercel project snapshot (names/status only)

The connected project is `nova-commerce` (`Next.js`, project ID `prj_2AkA0z1HAwfSSXLaxJvoQTSdzTQU`). At audit time, its listed project variables applied to **Production, Preview, and Development**. Populated entries included `DATABASE_URL`, `ADMIN_EMAIL`, SMTP host/port/user, sender name/address, order notification email, S3 endpoint/region/bucket, and `NEXT_PUBLIC_SITE_URL`. The project also listed blank values for `ADMIN_PASSWORD`, `SMTP_PASS`, both S3 access credentials, and `AUTH_SECRET`. `EXCHANGE_RATE_API`, `DEPLOY_DB`, and `PGLITE_PORT` were not listed (the first uses its code default; the latter two are optional/local or policy controls). Encrypted values were not decrypted or copied here.

Consequences of this snapshot:

- `SMTP_PASS` being blank means the application considers email unconfigured; production register/resend/reset flows fail closed, and the admin email-test endpoint should return HTTP 400 with its explicit missing-SMTP message. A reported HTTP 502 indicates an attempted send failed after configuration was considered complete; inspect the matching deployment's protected runtime/email logs and provider response rather than assuming the missing-password path.
- The S3 credentials are blank, so uploads should report storage unavailable. The admin settings health indicator has been fixed to use the same complete four-part check as the upload path; before this fix it could report storage as configured with only an endpoint, bucket, and access-key ID.
- Blank `ADMIN_PASSWORD` does not change an existing admin credential. A build against an empty database will fail seeding until the initial admin values are provided.
- The Vercel `NEXT_PUBLIC_SITE_URL` was set to the project's `.vercel.app` storefront URL and applied to all scopes. Verify it matches the canonical public production host you intend to use.

## Release addendum

During the current release, the Vercel project was configured with the plain, non-secret `DEPLOY_DB=0` variable for both **Production** and **Preview**. This is a deliberate safety guard: Vercel build hooks must not run the repository's migration, seed, and settings-sync scripts against the database shared by Preview and Production. No database schema changes are included in this release. Apply future schema/data migrations through an explicitly reviewed maintenance/deploy step; normal Vercel builds will not apply them automatically until this policy is changed.

The prior inventory above records the earlier state, when `DEPLOY_DB` was absent; this addendum supersedes that status for the current Vercel project.

## Analytics / encrypted SMTP release notes (2026-11-13)

This branch adds an additive `analytics_events` table and indexes in `scripts/schema.sql`. The current Vercel policy keeps `DEPLOY_DB=0`, so normal deploy builds skip migration, seeding, and settings synchronization. No production database query or mutation was performed in this release. Until an explicitly approved migration runs, the analytics API falls back gracefully and labels funnel-event storage unavailable; add-to-cart, checkout, and purchase event writes are best-effort and will not be retained. Existing order/page-view reports continue to use the current schema.

Owner-managed SMTP settings are stored as an AES-256-GCM ciphertext under the existing `settings` table key `smtp_config`; the separate server-side `SMTP_CREDENTIALS_KEY` must be configured before saving credentials. Suggested generation command (run in a trusted secret manager/shell, and do not paste the output into chat or commit it): `openssl rand -base64 32`. Set the value only in the server environment(s) where owner-managed SMTP is needed. It is not currently configured by this code change. The SMTP configuration page remains unable to save until that key is set. Existing SMTP environment variables remain the fallback transport.

Dependency audit found the Next.js-pinned PostCSS `8.4.31` in an affected range; `package.json` now overrides PostCSS to `^8.5.33`. The lockfile installs `8.5.33`, `npm audit` reports zero vulnerabilities, and the production build passes with the override.

No production release, database migration, SMTP credential save, or SMTP delivery test was performed as part of this branch work.

## Production/backend notes

- The connected production deployment observed during this audit was `READY`/`PROMOTED`, running the previously deployed commit `cdb2dceedfc50ad836754bcf91965556752b2e54`. The latest cleanup preview (`5cd80ff`) also reported `READY` after its earlier `BUILDING` state. This describes Vercel deployment status only; it is not a smoke test of current production routes or a deployment of this audit.
- Database migrations and seed/sync run as part of the configured build command via `npm run build`. They are intended to be idempotent, but share a DB across preview/production increases operational risk and must be separated or tightly controlled.
- The application includes password hashing, database-backed sessions, admin roles/permissions, and API rate limits. The rate-limit store is process-local and is not globally shared across serverless instances; it is not a substitute for a distributed/WAF rate limiter at scale.
- No production deployment was performed for this audit. Vercel variables were only inspected, not edited.

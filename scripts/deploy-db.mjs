/**
 * Runs before `next build` on Vercel so the production database always matches
 * the deployed code. Both steps are idempotent and never drop data.
 * Set DEPLOY_DB=0 in the environment to skip (e.g. local builds).
 */
import { spawnSync } from 'node:child_process';

const skip = process.env.DEPLOY_DB === '0' || process.env.VERCEL_ENV === 'development';
if (skip) {
  console.log('→ deploy-db: skipped (DEPLOY_DB=0)');
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error('✖ DATABASE_URL is not set — cannot prepare the database.');
  process.exit(1);
}

for (const script of ['scripts/migrate.mjs', 'scripts/seed.mjs', 'scripts/sync-settings.mjs']) {
  const res = spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
  if (res.status !== 0) {
    console.error(`✖ ${script} failed with exit code ${res.status}`);
    process.exit(res.status || 1);
  }
}

// Temporary Vercel-preview-only owner recovery. Remove the scoped variables immediately after use.
if (process.env.NOVA_ADMIN_RESET_PASSWORD_ONCE) {
  const expectedBranch = 'arena/f7636a7d-e-commerce';
  const permitted = process.env.VERCEL_ENV === 'preview'
    && process.env.VERCEL_GIT_COMMIT_REF === expectedBranch
    && process.env.NOVA_ADMIN_RESET_CONFIRM === 'reset-owner-once';
  if (!permitted) {
    console.error('✖ Refusing admin recovery outside its confirmed Vercel preview branch.');
    process.exit(1);
  }
  const res = spawnSync(process.execPath, ['scripts/set-admin-password.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, ADMIN_PASSWORD: process.env.NOVA_ADMIN_RESET_PASSWORD_ONCE },
  });
  if (res.status !== 0) {
    console.error(`✖ Vercel preview owner recovery failed with exit code ${res.status}`);
    process.exit(res.status || 1);
  }
}

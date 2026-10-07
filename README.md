# PriceShift for Vercel + Supabase

This is a Next.js rebuild of the supplier-pricing workspace. It keeps the PriceShift interface and its main operating flow while moving the production data design from Symfony/MySQL to Supabase/Postgres.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment variables the app displays its authentication setup screen. Add the two public variables before using the workspace.

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql) in the Supabase SQL editor or through the Supabase CLI.
3. Add the project URL and anon key to Vercel and `.env.local`, based on `.env.example`.
4. In Supabase Auth, enable Email sign-in and update the email template to include the OTP token (`{{ .Token }}`), rather than only a magic link.
5. Run [`supabase/migrations/0002_skip_workspace_setup_for_invited_users.sql`](supabase/migrations/0002_skip_workspace_setup_for_invited_users.sql) after the initial migration. Sign in with an email and verification code. The migration automatically creates the first owner’s workspace, admin membership, and default pricing settings.

## Manage workspace users

Workspace admins can add users from **Settings → Users**, select an admin, editor, or viewer role, change roles, and remove workspace access. Adding a new email sends Supabase’s invitation email; after accepting it, the person signs in using the usual one-time email code. Existing Supabase users are added immediately.

Add your deployed callback URL (for example `https://priceshift.iweb-app.com/auth`) to Supabase Auth’s redirect URL allow list. Invitation links return there to establish the invited user’s browser session.

If the first owner sees “No pricing workspace is assigned to this user”, their auth account was created before the initial workspace trigger was installed. In the Supabase SQL editor, edit the email and workspace name at the top of [`supabase/setup/first_workspace.sql`](supabase/setup/first_workspace.sql), then run it once. Sign out and back in afterwards; the owner will be an admin and can manage everyone from Settings.

The schema covers workspaces and roles, pricing thresholds, products, import batches, and immutable audit events. Product rows use pence for prices to avoid currency rounding errors; every row belongs to a workspace.

Magento credentials and AI provider keys are workspace-scoped. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `INTEGRATION_SECRET_ENCRYPTION_KEY` as Vercel server-only environment variables; do not expose them with a `NEXT_PUBLIC_` prefix. Generate the encryption key once with `openssl rand -base64 32`, store its output as `INTEGRATION_SECRET_ENCRYPTION_KEY` in Vercel and `.env.local`, and retain the same value. Changing it makes previously stored Magento tokens unreadable.

## Magento catalogue sync

Run [`supabase/migrations/0003_magento_sync_jobs.sql`](supabase/migrations/0003_magento_sync_jobs.sql) after the earlier migrations. The **Import from Magento** action queues a catalogue job; it does not hold the browser open. The Vercel Cron worker processes 25 products and their custom options per minute, records progress in Supabase, and resumes a queued job from its saved page. Add a long random `CRON_SECRET` to Vercel and the production environment before deploying; [`vercel.json`](vercel.json) runs the protected worker each minute. Failed jobs can be retried by clicking Import from Magento again.

Magento requests identify themselves with `User-Agent: PriceShift-Magento-Sync/1.0`. Set `MAGENTO_SYNC_USER_AGENT` if your Magento allowlist requires a different stable value.

## Deploy to Vercel

Import this folder as a Vercel project, use the default Next.js build settings, and add the public Supabase variables plus the four server-only variables listed in `.env.example`. The `npm run build` command is the deployment check.

## Price changes

**Modify Prices** combines the supplier cost upload with manual price uplifts. Manual uplifts can be limited by SKU, category, and brand. They are staged with their old and proposed selling prices, and optionally uplift fixed-price Magento custom options. The review queue lets an editor select rows for bulk publishing; each selected product and option price is then sent to Magento and recorded in the audit log.

Run [`supabase/migrations/0004_price_change_reviews.sql`](supabase/migrations/0004_price_change_reviews.sql) after the earlier migrations to enable this workflow.

Run [`supabase/migrations/0005_cost_visibility.sql`](supabase/migrations/0005_cost_visibility.sql) to add the workspace setting that hides cost and margin fields for price-only workflows.

## Routes

`/` dashboard · `/products` workbench · `/prices` modify prices · `/prices/review` publish queue · `/upload` cost-import wizard · `/analysis` margin analysis · `/audit` approval history · `/settings` pricing rules.

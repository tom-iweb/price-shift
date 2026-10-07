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
5. Sign in with an email and verification code. The migration automatically creates the user’s first workspace, admin membership, and default pricing settings.

The schema covers workspaces and roles, pricing thresholds, products, import batches, and immutable audit events. Product rows use pence for prices to avoid currency rounding errors; every row belongs to a workspace.

Magento credentials and AI provider keys are workspace-scoped. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `INTEGRATION_SECRET_ENCRYPTION_KEY` as Vercel server-only environment variables; do not expose them with a `NEXT_PUBLIC_` prefix. Magento sync uses the Magento 2 REST API to upsert products and custom options into Supabase.

## Deploy to Vercel

Import this folder as a Vercel project, use the default Next.js build settings, and add the public Supabase variables plus the three server-only variables listed in `.env.example`. The `npm run build` command is the deployment check.

## Routes

`/` dashboard · `/products` workbench · `/upload` cost-import wizard · `/analysis` margin analysis · `/audit` approval history · `/settings` pricing rules.

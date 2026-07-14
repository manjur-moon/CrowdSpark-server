# CrowdSpark Deployment Guide

## 1. Prerequisites

- Separate GitHub client and server repositories.
- MongoDB Atlas connection with transaction support.
- Vercel account for the client.
- Render account for the server.
- Production Better Auth secret and withdrawal encryption key.
- Optional Google OAuth, Stripe, and ImgBB credentials.

## 2. Prepare repositories

Run `prepare-repositories.ps1` or `prepare-repositories.sh`, then initialize and push each output folder to its own GitHub repository. Do not include `.env`, `node_modules`, `dist`, coverage, Playwright reports, or test results.

## 3. MongoDB Atlas

1. Create a database user with a strong unique password.
2. Configure network access for Render.
3. Copy the application connection string into Render as `MONGODB_URI`.
4. Set `MONGODB_DB_NAME=crowdspark`.
5. Run migrations once against the production database before seeding or accepting traffic.

## 4. Deploy server to Render

The server repository contains `render.yaml` and `Procfile`.

Recommended settings:

```text
Runtime: Node
Build command: npm ci && npm run build
Start command: npm start
Health check path: /api/v1/health
```

Set these Render environment variables:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=ADD_ATLAS_CONNECTION_STRING
MONGODB_DB_NAME=crowdspark
CLIENT_URL=ADD_VERCEL_CLIENT_ORIGIN
BETTER_AUTH_URL=ADD_RENDER_SERVER_ORIGIN
BETTER_AUTH_SECRET=ADD_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
WITHDRAWAL_ENCRYPTION_KEY=ADD_64_HEX_CHARACTERS
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
DEMO_PAYMENTS=false
IMGBB_API_KEY=
```

After first deployment:

```bash
npm run migrate:financial-security
npm run migrate:auth-rbac
```

Seed production only when demo accounts are explicitly required by the assignment. Change demo passwords afterward if the deployment is public.

## 5. Deploy client to Vercel

Import the client repository and use:

```text
Framework preset: Vite
Build command: npm run build
Output directory: dist
Install command: npm ci
```

Set:

```env
VITE_API_BASE_URL=ADD_RENDER_SERVER_ORIGIN/api/v1
VITE_AUTH_BASE_URL=ADD_RENDER_SERVER_ORIGIN
VITE_GITHUB_URL=ADD_CLIENT_REPOSITORY_URL
VITE_LINKEDIN_URL=ADD_LINKEDIN_PROFILE_URL
VITE_FACEBOOK_URL=ADD_SOCIAL_PROFILE_URL
VITE_CONTACT_EMAIL=ADD_CONTACT_EMAIL
VITE_CONTACT_PHONE=ADD_CONTACT_PHONE
```

`vercel.json` rewrites SPA routes to `index.html`, allowing direct refresh on dashboard and campaign routes.

## 6. Configure Better Auth and Google OAuth

- `BETTER_AUTH_URL` must be the public Render origin.
- `CLIENT_URL` must exactly match the Vercel production origin.
- Add both origins to the relevant trusted-origin/CORS configuration.
- In Google Cloud, add the production Better Auth callback URL shown by the configured provider.
- Never put `GOOGLE_CLIENT_SECRET` in Vercel.

## 7. Configure Stripe

1. Use production/test Stripe keys according to deployment purpose.
2. Create a webhook endpoint at:

```text
ADD_RENDER_SERVER_ORIGIN/api/v1/payments/webhook
```

3. Subscribe to `checkout.session.completed`.
4. Put the generated signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Keep `DEMO_PAYMENTS=false` for real production payment flows.
6. Run one low-value test and confirm one Payment, one wallet credit transaction, one notification, and one processed Stripe-event record.

## 8. Configure ImgBB

Set `IMGBB_API_KEY` only on Render. Without it, local demo mode stores data URLs; production should use ImgBB or another durable image provider.

## 9. Production verification

- Render health endpoint returns 200.
- Vercel home, campaign details, login, and every private dashboard route survive direct refresh.
- Registration/login/logout and Google login work.
- Supporter/Creator/Admin demo accounts reach only their permitted routes.
- Search, filters, sorting, and pagination work against the live API.
- Stripe webhook credits once, including duplicate webhook delivery.
- Withdrawal account details are masked in API/UI and encrypted in MongoDB.
- Role/status changes revoke active sessions.
- CORS blocks unknown origins.
- No source map, log, API response, README, or screenshot exposes a secret.

## 10. Submission updates

Replace all `ADD_*` placeholders in root, client, and server README files. Add real screenshots. Verify both repository commit counts and live URLs before submission.

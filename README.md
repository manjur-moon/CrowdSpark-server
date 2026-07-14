# CrowdSpark Server

Express, TypeScript, MongoDB, Better Auth, Stripe, and ImgBB-ready API for CrowdSpark.

## Links

- Live API: `ADD_RENDER_SERVER_URL`
- Live client: `ADD_VERCEL_CLIENT_URL`
- Server repository: `ADD_SERVER_GITHUB_REPOSITORY_URL`
- Client repository: `ADD_CLIENT_GITHUB_REPOSITORY_URL`

## Local setup

```bash
npm install
cp .env.example .env
npm run migrate:financial-security
npm run migrate:auth-rbac
npm run seed
npm run dev
```

Financial transactions require MongoDB Atlas or another replica-set-enabled MongoDB deployment.

## Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run test:integration
npm run build
npm start
```

## Health check

```text
GET /api/v1/health
```

## Deployment

`render.yaml` and `Procfile` are included. Configure all values from `.env.example` in the Render environment dashboard. Use the public Render URL for `BETTER_AUTH_URL`; use the Vercel URL for `CLIENT_URL`. Add Stripe webhook delivery to `/api/v1/payments/webhook`.

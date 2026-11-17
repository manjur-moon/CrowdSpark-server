# CrowdSpark server — authentication troubleshooting

Use the paired fixed frontend archive. The complete setup and browser/network checklist is in the client archive's `AUTHENTICATION_FIX_GUIDE.md`.

- `CLIENT_URL`: HTTPS origin of frontend, exactly as used in browser.
- `BETTER_AUTH_URL`: HTTPS origin of this API (not the `/api/auth` path).
- `BETTER_AUTH_SECRET`: stable random secret, 32+ characters. Do not rotate casually.
- `MONGODB_URI` and `MONGODB_DB_NAME`: database must be reachable and writable; the JWT plugin stores keys in `jwks`.
- `NODE_ENV=production`: uses secure cross-site cookies; use same-site custom domains or a reverse proxy where third-party cookies are blocked.

Check `/api/v1/health`, `/api/auth/get-session`, `/api/auth/token`, then `/api/v1/users/me` in that order. A JWT is optional for browser sessions; the API validates the Better Auth cookie if no bearer token is supplied.

Use `npm ci && npm run build && npm test` in this directory after the environment and dependencies are available. Tests using `mongodb-memory-server` may need a MongoDB binary download.

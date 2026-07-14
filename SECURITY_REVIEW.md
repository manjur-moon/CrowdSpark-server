# CrowdSpark Security Review

## Authentication and authorization

- Better Auth is the source of identity and session state.
- Protected APIs require a signed short-lived access token tied to an active Better Auth session.
- Every token carries an authorization version; role/status changes increment it and revoke sessions.
- RBAC is enforced server-side, not only by React routes.
- Suspended and banned accounts are blocked.
- Admin self-demotion, self-suspension, self-removal, and final-active-Admin removal are blocked.

## Financial integrity

- Credits and money are integers, never floating-point wallet balances.
- Contribution, approval, rejection/refund, payment completion, withdrawal reservation/review, and campaign deletion refund operations use MongoDB transactions.
- Financial requests use idempotency keys.
- Stripe package price is selected on the server.
- Stripe wallet crediting happens only after webhook signature verification.
- Processed Stripe event IDs are stored to block duplicate crediting.
- Ledger records are append-only application records.

## Sensitive data

- Withdrawal account references use AES-256-GCM encryption.
- API serialization returns masked last-four information.
- Real secrets are environment variables and `.env` is ignored.
- Production logs must not include request bodies for payment, account, token, or secret endpoints.

## Input and API protection

- Zod validates request body, params, and query data.
- Helmet security headers, CORS allow-list, JSON size limits, rate limiting, centralized error handling, and safe error messages are enabled.
- Uploads allow only JPEG, PNG, and WebP with a 3 MB limit.
- Ownership checks use stored profile IDs, not client-provided email or owner IDs.

## Deployment checklist

- Rotate all demo and development secrets.
- Use `DEMO_PAYMENTS=false` in production.
- Use HTTPS origins for Render/Vercel/Google/Stripe.
- Limit Atlas database user permissions.
- Restrict Atlas network access where possible.
- Preserve `WITHDRAWAL_ENCRYPTION_KEY`; changing it makes existing encrypted payout references unreadable.
- Review Admin audit logs regularly.

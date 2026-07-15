<div align="center">

# CrowdSpark API

### Secure REST API for the CrowdSpark role-based crowdfunding platform.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Better Auth](https://img.shields.io/badge/Auth-Better_Auth-111827)](https://www.better-auth.com/)
[![Stripe](https://img.shields.io/badge/Payments-Stripe-635BFF?logo=stripe&logoColor=white)](https://stripe.com/)

[Live API](https://YOUR_SERVER_DOMAIN.onrender.com) · [Live Website](https://YOUR_CLIENT_DOMAIN.vercel.app) · [Server Repository](https://github.com/YOUR_GITHUB_USERNAME/CrowdSpark-server) · [Client Repository](https://github.com/YOUR_GITHUB_USERNAME/CrowdSpark-client)

</div>

> [!IMPORTANT]
> Replace every `YOUR_*` placeholder before final submission. Never commit a real `.env` file or secret value.

---

## Table of Contents

- [Overview](#overview)
- [Project Links](#project-links)
- [Demo Credentials](#demo-credentials)
- [Core Capabilities](#core-capabilities)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Security and Financial Integrity](#security-and-financial-integrity)
- [API Overview](#api-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Migration and Seed](#database-migration-and-seed)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Health Check](#health-check)
- [Related Repository](#related-repository)
- [Author](#author)

---

## Overview

This repository contains the **Express + TypeScript backend** for **CrowdSpark**, a role-based crowdfunding platform supporting three roles: Supporter, Creator, and Admin.

The API provides authentication, JWT access-token validation, role-based authorization, campaign management, contribution processing, wallet and payment history, refunds, notifications, campaign updates, report moderation, encrypted withdrawal information, Stripe checkout/webhook processing, financial ledger records, and administrative audit trails.

Financial operations use integer credits and integer cents. Critical multi-document operations are designed to run inside MongoDB transactions, which requires MongoDB Atlas or another replica-set-enabled MongoDB deployment.

---

## Project Links

| Resource | URL |
|---|---|
| Live API | `https://YOUR_SERVER_DOMAIN.onrender.com` |
| Live Website | `https://YOUR_CLIENT_DOMAIN.vercel.app` |
| Server Repository | `https://github.com/YOUR_GITHUB_USERNAME/CrowdSpark-server` |
| Client Repository | `https://github.com/YOUR_GITHUB_USERNAME/CrowdSpark-client` |

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@crowdspark.demo` | `Admin12345` |
| Creator | `creator@crowdspark.demo` | `Creator12345` |
| Supporter | `supporter@crowdspark.demo` | `Supporter12345` |

> Run the seed command to create the demo accounts in a development database. Do not seed a production database containing real data.

---

## Core Capabilities

1. Better Auth email/password authentication
2. Google OAuth provider support
3. Short-lived JWT access tokens with JWKS verification
4. Supporter, Creator, and Admin role-based authorization
5. Account status enforcement for active, suspended, and banned users
6. Public campaign listing with search, filters, sorting, and pagination
7. Creator campaign CRUD and ownership checks
8. Admin campaign approval, rejection, suspension, and deletion
9. Transaction-safe supporter contribution workflow
10. Contribution approval, rejection, refunds, and wallet restoration
11. Stripe credit checkout and verified webhook fulfillment
12. Idempotency protection for Stripe and sensitive financial actions
13. Creator withdrawal requests and Admin review workflow
14. AES-256-GCM encryption for withdrawal account references
15. Immutable wallet/financial ledger records
16. Notification generation for important business actions
17. Campaign updates and report-management modules
18. Administrative audit logs
19. Zod request validation and centralized error handling
20. Rate limiting, Helmet security headers, CORS, and structured logging

---

## Technology Stack

### Runtime Dependencies

| Package | Purpose |
|---|---|
| Express | HTTP server and route handling |
| TypeScript | Static type safety |
| MongoDB Driver | Better Auth database access and low-level database operations |
| Mongoose | Domain models, indexes, queries, and transactions |
| Better Auth | Authentication and session management |
| Better Auth Mongo Adapter | MongoDB persistence for authentication records |
| Stripe | Checkout sessions and webhook verification |
| Zod | Request validation |
| Multer | Multipart image uploads |
| Helmet | Security-related HTTP headers |
| CORS | Allowed-origin configuration |
| Express Rate Limit | Abuse and brute-force protection |
| Morgan | Development HTTP logging |
| dotenv | Environment-variable loading |

### Development and Testing

| Package | Purpose |
|---|---|
| Vitest | Unit and integration tests |
| Supertest | API contract and integration testing |
| mongodb-memory-server | Isolated MongoDB replica-set tests |
| tsx | TypeScript development runner |
| ESLint | Static code analysis |
| Prettier | Code formatting |
| V8 Coverage | Coverage reports |

---

## System Architecture

```mermaid
flowchart TD
    Client[React Client] -->|Cookie + Bearer Token| API[Express API]
    API --> Auth[Better Auth]
    API --> Middleware[Session, JWT, RBAC, Validation]
    Middleware --> Routes[Module Routes]
    Routes --> Controllers[Controllers]
    Controllers --> Services[Services]
    Services --> Mongoose[Mongoose Models]
    Services --> Mongo[MongoDB / Atlas]
    Services --> Stripe[Stripe]
    Services --> ImgBB[ImgBB]
    Services --> Ledger[Wallet and Financial Ledger]
```

Module-oriented source structure:

```text
src/
├── config/             # Environment, database, Better Auth
├── middleware/         # Auth, RBAC, validation, error handling
├── models/             # Mongoose domain models
├── modules/
│   ├── admin/
│   ├── campaign/
│   ├── contribution/
│   ├── creator/
│   ├── financial/
│   ├── notification/
│   ├── payment/
│   ├── public/
│   ├── report/
│   ├── upload/
│   └── user/
├── scripts/            # Database migrations
├── utils/              # Encryption, transactions, pagination, errors
├── app.ts               # Express application
├── server.ts            # Production server entry
└── seed.ts              # Development seed data
```

---

## Security and Financial Integrity

- Password and OAuth account management are delegated to Better Auth.
- Protected API routes require a valid session and signed access token.
- Role and account status are verified on the server; client-provided roles are never trusted.
- Role/status changes invalidate previous authorization state.
- Suspended and banned accounts are blocked from protected operations.
- Sensitive withdrawal account references are encrypted with AES-256-GCM.
- Only masked account information is exposed to clients.
- Credits and currency values use integers to avoid floating-point balance errors.
- Contribution, refund, Stripe-credit, withdrawal, and campaign-refund workflows use MongoDB transactions.
- Stripe webhook events and sensitive mutations use idempotency protection.
- Security headers, CORS, rate limiting, and centralized error handling are enabled.
- Real secrets belong only in deployment environment variables and local `.env` files.

---

## API Overview

Base URL:

```text
http://localhost:5000/api/v1
```

Authentication endpoints are served under:

```text
http://localhost:5000/api/auth
```

### Public API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | API health check |
| `GET` | `/api/v1/stats` | Public platform statistics |
| `GET` | `/api/v1/campaigns/categories` | Campaign categories |
| `GET` | `/api/v1/campaigns` | Search/filter/sort approved campaigns |
| `GET` | `/api/v1/campaigns/:campaignId` | Public campaign details |
| `GET` | `/api/v1/campaigns/:campaignId/updates` | Public campaign updates |
| `POST` | `/api/v1/contact` | Store a contact message |

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/sign-up/email` | Email/password registration |
| `POST` | `/api/auth/sign-in/email` | Email/password login |
| `GET` | `/api/auth/get-session` | Current Better Auth session |
| `GET` | `/api/auth/token` | Short-lived JWT access token |
| `POST` | `/api/auth/sign-out` | End the current session |
| `GET` | `/api/auth/callback/google` | Google OAuth callback |

### User and Wallet

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Session | Current user and profile |
| `POST` | `/api/v1/users/onboarding` | Session | Complete role onboarding |
| `GET` | `/api/v1/users/wallet/transactions` | Authenticated | Wallet ledger history |

### Campaigns

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/campaigns/mine` | Creator/Admin | Owned campaigns |
| `POST` | `/api/v1/campaigns` | Creator/Admin | Create campaign |
| `PATCH` | `/api/v1/campaigns/:campaignId` | Creator/Admin | Update campaign |
| `DELETE` | `/api/v1/campaigns/:campaignId` | Creator | Delete/refund/archive campaign |

### Supporter Contributions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/contributions/dashboard` | Supporter | Contribution summary |
| `POST` | `/api/v1/contributions` | Supporter | Create contribution |
| `GET` | `/api/v1/contributions/mine` | Supporter | Paginated contribution history |
| `GET` | `/api/v1/contributions/mine/:contributionId` | Supporter | Contribution details |
| `POST` | `/api/v1/contributions/:contributionId/refund-requests` | Supporter | Request refund |

### Creator Operations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/creator/dashboard` | Creator analytics |
| `GET` | `/api/v1/creator/campaigns` | Creator campaigns |
| `GET` | `/api/v1/creator/contributions` | Contributions requiring review |
| `POST` | `/api/v1/creator/contributions/:id/approve` | Approve contribution |
| `POST` | `/api/v1/creator/contributions/:id/reject` | Reject and restore credits |
| `GET` | `/api/v1/creator/campaigns/:id/updates` | Campaign updates |
| `POST` | `/api/v1/creator/campaigns/:id/updates` | Publish update |
| `PATCH` | `/api/v1/creator/campaigns/:id/updates/:updateId` | Edit update |
| `DELETE` | `/api/v1/creator/campaigns/:id/updates/:updateId` | Delete update |
| `GET` | `/api/v1/creator/withdrawals` | Withdrawal history |
| `POST` | `/api/v1/creator/withdrawals` | Request withdrawal |

### Payments

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/payments/packages` | Public | Credit packages |
| `GET` | `/api/v1/payments/mine` | Supporter | Payment history |
| `POST` | `/api/v1/payments/demo` | Supporter | Demo credit purchase |
| `POST` | `/api/v1/payments/checkout` | Supporter | Create Stripe checkout session |
| `POST` | `/api/v1/payments/webhook` | Stripe | Verify and process Stripe events |

### Notifications, Reports, and Uploads

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Authenticated | Notification list |
| `GET` | `/api/v1/notifications/unread-count` | Authenticated | Unread count |
| `PATCH` | `/api/v1/notifications/read-all` | Authenticated | Mark all read |
| `PATCH` | `/api/v1/notifications/:id/read` | Authenticated | Mark one read |
| `POST` | `/api/v1/reports` | Supporter/Creator | Submit a report |
| `POST` | `/api/v1/uploads/images` | Authenticated | Upload a validated image |

### Admin API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/dashboard` | Admin analytics |
| `GET` | `/api/v1/admin/users` | List/search/filter users |
| `PATCH` | `/api/v1/admin/users/:id/role` | Update role |
| `PATCH` | `/api/v1/admin/users/:id/status` | Activate/suspend/ban user |
| `DELETE` | `/api/v1/admin/users/:id` | Securely remove user |
| `GET` | `/api/v1/admin/campaigns` | Campaign moderation list |
| `POST` | `/api/v1/admin/campaigns/:id/approve` | Approve campaign |
| `POST` | `/api/v1/admin/campaigns/:id/reject` | Reject campaign |
| `POST` | `/api/v1/admin/campaigns/:id/suspend` | Suspend campaign |
| `DELETE` | `/api/v1/admin/campaigns/:id` | Delete/refund/archive campaign |
| `GET` | `/api/v1/admin/reports` | Report list |
| `POST` | `/api/v1/admin/reports/:id/resolve` | Resolve report |
| `POST` | `/api/v1/admin/reports/:id/dismiss` | Dismiss report |
| `GET` | `/api/v1/admin/withdrawals` | Withdrawal list |
| `POST` | `/api/v1/admin/withdrawals/:id/approve` | Approve settlement |
| `POST` | `/api/v1/admin/withdrawals/:id/reject` | Reject and restore balance |
| `GET` | `/api/v1/admin/finance/summary` | Financial summary |
| `GET` | `/api/v1/admin/payments` | Payment records |
| `GET` | `/api/v1/admin/ledger` | Financial ledger |
| `GET` | `/api/v1/admin/audit-logs` | Administrative audit history |

> Sensitive mutation endpoints may require an `Idempotency-Key` header. Refer to the controller/validation code for the exact request schema.

---

## Getting Started

### Prerequisites

- Node.js `20.19.0` or newer
- npm
- MongoDB Atlas or a replica-set-enabled MongoDB deployment
- Stripe account for real payment testing
- Google Cloud OAuth credentials for Google login
- ImgBB API key for production image hosting

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/CrowdSpark-server.git
cd CrowdSpark-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env`

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 4. Generate secure values

Generate a Better Auth secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command again to generate a separate 64-character withdrawal encryption key.

### 5. Run migrations

```bash
npm run migrate:financial-security
npm run migrate:auth-rbac
```

### 6. Seed the development database

```bash
npm run seed
```

### 7. Start the API

```bash
npm run dev
```

API:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/v1/health
```

---

## Environment Variables

```env
NODE_ENV=development
PORT=5000

MONGODB_URI=mongodb+srv://DATABASE_USER:DATABASE_PASSWORD@YOUR_CLUSTER.mongodb.net/crowdspark?retryWrites=true&w=majority
MONGODB_DB_NAME=crowdspark

CLIENT_URL=http://localhost:5173
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
DEMO_PAYMENTS=true

IMGBB_API_KEY=YOUR_IMGBB_API_KEY

WITHDRAWAL_ENCRYPTION_KEY=REPLACE_WITH_64_HEXADECIMAL_CHARACTERS
```

| Variable | Required | Description |
|---|---:|---|
| `NODE_ENV` | Yes | `development`, `test`, or `production` |
| `PORT` | Yes | Express server port |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | Yes | Database name |
| `CLIENT_URL` | Yes | Exact allowed frontend origin |
| `BETTER_AUTH_URL` | Yes | Public backend origin used by Better Auth |
| `BETTER_AUTH_SECRET` | Yes | Secure Better Auth signing secret |
| `GOOGLE_CLIENT_ID` | Google login | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google login | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Real payments | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Real payments | Stripe webhook signing secret |
| `DEMO_PAYMENTS` | Yes | Enables/disables local demo payments |
| `IMGBB_API_KEY` | Production images | ImgBB upload API key |
| `WITHDRAWAL_ENCRYPTION_KEY` | Yes | 32-byte AES key encoded as 64 hex characters |

Never commit `.env`. Only `.env.example` with safe placeholders should be tracked.

---

## Database Migration and Seed

Run migrations after configuring MongoDB:

```bash
npm run migrate:financial-security
npm run migrate:auth-rbac
```

Development seed:

```bash
npm run seed
```

Warnings:

- Back up an existing database before migration.
- Do not change `WITHDRAWAL_ENCRYPTION_KEY` after encrypted production records exist.
- Do not run the development seed against a production database with real data.
- MongoDB transactions require a replica set; MongoDB Atlas is recommended.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with watch mode |
| `npm run build` | Compile TypeScript to `dist` |
| `npm start` | Run the compiled production server |
| `npm run seed` | Seed development/demo data |
| `npm run dev:demo` | Start zero-config demo mode |
| `npm run migrate:financial-security` | Migrate encrypted/financial fields |
| `npm run migrate:auth-rbac` | Migrate authorization fields |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Verify formatting |
| `npm test` | Run the Vitest suite |
| `npm run test:unit` | Run unit/contract tests |
| `npm run test:integration` | Run transaction and RBAC integration tests |
| `npm run test:coverage` | Generate coverage reports |
| `npm run test:all` | Run unit and integration tests |

---

## Testing

Standard verification:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Integration tests:

```bash
npm run test:integration
```

`mongodb-memory-server` may download a MongoDB binary during the first integration-test run.

Important test areas include:

- Better Auth and access-token authentication
- Role-based authorization
- Suspended/banned-account blocking
- Campaign ownership and moderation
- Contribution transactions and refunds
- Stripe webhook idempotency
- Withdrawal encryption and balance restoration
- Admin audit-log idempotency
- Search, filter, and pagination contracts

---

## Deployment

### Render

1. Push this repository to GitHub.
2. Create a Render Web Service or Blueprint deployment.
3. Use `npm ci && npm run build` as the build command.
4. Use `npm start` as the start command.
5. Set the health-check path to `/api/v1/health`.
6. Add every required environment variable in the Render dashboard.
7. Set `CLIENT_URL` to the exact Vercel origin.
8. Set `BETTER_AUTH_URL` to the public Render origin.
9. Run both database migrations against the production database.
10. Configure Google OAuth and Stripe webhook production URLs.

Google callback:

```text
https://YOUR_SERVER_DOMAIN.onrender.com/api/auth/callback/google
```

Stripe webhook:

```text
https://YOUR_SERVER_DOMAIN.onrender.com/api/v1/payments/webhook
```

The repository includes `render.yaml` and a `Procfile` for deployment support.

---

## Health Check

Request:

```http
GET /api/v1/health
```

Local URL:

```text
http://localhost:5000/api/v1/health
```

Expected response:

```json
{
  "success": true
}
```

The root route `/` is not an application page and may return a route-not-found response. Use `/api/v1/health` to verify the server.

---

## Related Repository

The React frontend, public pages, dashboards, charts, forms, protected routes, and Vercel configuration are maintained in:

**Client Repository:** `https://github.com/YOUR_GITHUB_USERNAME/CrowdSpark-client`

---

## Author

**Manjurul Islam**

- GitHub: `https://github.com/YOUR_GITHUB_USERNAME`
- LinkedIn: `https://www.linkedin.com/in/YOUR_LINKEDIN_PROFILE`
- Email: `YOUR_EMAIL@example.com`

---

## License

No open-source license has been specified. Add a `LICENSE` file before allowing third-party reuse or redistribution.

# CrowdSpark API Documentation

Base URL: `SERVER_ORIGIN/api/v1`

Authentication uses a Better Auth session and a short-lived bearer access token for protected application endpoints. Mutating financial/Admin endpoints also require an `Idempotency-Key` header.

## Response contract

```json
{
  "success": true,
  "message": "Optional message",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

Errors use a centralized shape with an HTTP status, stable error code, and safe message.

## Public and authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| GET | `/stats` | Public | Platform statistics |
| GET | `/campaigns` | Public | Approved campaign search/filter/sort/pagination |
| GET | `/campaigns/featured` | Public | Featured campaigns |
| GET | `/campaigns/top-funded` | Public | Top funded campaigns |
| GET | `/campaigns/categories` | Public | Category counts |
| GET | `/campaigns/:campaignId` | Public | Campaign details |
| GET | `/campaigns/:campaignId/updates` | Public | Published campaign updates |
| POST | `/contact` | Public | Save contact message |
| ALL | `/api/auth/*` | Public/session | Better Auth endpoints |

## Users and onboarding

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/users/me` | Authenticated | Current application profile and wallet |
| POST | `/users/onboarding/role` | Authenticated | Select Supporter/Creator role and one-time bonus |
| PATCH | `/users/me` | Authenticated | Update profile data |
| GET | `/users/access-token` | Active session | Issue short-lived application JWT |

## Campaigns

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/campaigns/mine` | Creator/Admin | List owned campaigns |
| POST | `/campaigns` | Creator/Admin | Create and submit campaign |
| PATCH | `/campaigns/:campaignId` | Owner/Admin | Edit eligible campaign |
| DELETE | `/campaigns/:campaignId` | Creator owner | Delete/refund or archive campaign |

Create/update validation includes title, description, story, category, integer goal/minimum contribution, future deadline, cover image, up to six gallery images, reward information, and location.

## Supporter contributions

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/contributions/dashboard` | Supporter | Contribution analytics |
| POST | `/contributions` | Supporter | Deduct credits and create pending contribution |
| GET | `/contributions/mine` | Supporter | Contribution history |
| GET | `/contributions/mine/:contributionId` | Owner Supporter | Contribution details/refund eligibility |
| POST | `/contributions/:contributionId/refund-requests` | Owner Supporter | Request refund review |

`POST /contributions` requires `Idempotency-Key`. The service validates campaign approval, deadline, minimum amount, wallet balance, and performs deductions and ledger creation in a MongoDB transaction.

## Creator management

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/creator/dashboard` | Creator | Creator analytics |
| GET | `/creator/campaigns` | Creator | Campaign selector/list |
| GET | `/creator/contributions` | Creator | Owned campaign contribution management |
| POST | `/creator/contributions/:contributionId/approve` | Owner Creator | Approve pending contribution |
| POST | `/creator/contributions/:contributionId/reject` | Owner Creator | Reject and refund pending contribution |
| GET | `/creator/campaigns/:campaignId/updates` | Owner Creator | List campaign updates |
| POST | `/creator/campaigns/:campaignId/updates` | Owner Creator | Publish update |
| PATCH | `/creator/campaigns/:campaignId/updates/:updateId` | Owner Creator | Edit update |
| DELETE | `/creator/campaigns/:campaignId/updates/:updateId` | Owner Creator | Delete update |
| GET | `/creator/withdrawals` | Creator | Withdrawal history |
| POST | `/creator/withdrawals` | Creator | Reserve balance and request withdrawal |

Contribution review and withdrawal creation require `Idempotency-Key`.

## Payments

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/payments/packages` | Public | Supported server-priced credit packages |
| GET | `/payments/mine` | Supporter | Payment history |
| POST | `/payments/demo` | Supporter/demo | Idempotent demo purchase |
| POST | `/payments/checkout` | Supporter | Create Stripe Checkout session |
| POST | `/payments/webhook` | Stripe signature | Complete verified payment transaction |

Credit package prices are selected on the server. The payment-success page never credits the wallet. Only a verified webhook or explicitly enabled demo payment can do that.

## Notifications

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Paginated notification list |
| GET | `/notifications/unread-count` | Authenticated | Unread counter |
| PATCH | `/notifications/read-all` | Authenticated | Mark all read |
| PATCH | `/notifications/:notificationId/read` | Owner | Mark one read |

## Reports and uploads

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/reports` | Authenticated | Report a campaign |
| POST | `/uploads/images` | Authenticated | JPEG/PNG/WebP image upload, max 3 MB |

## Admin

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/dashboard` | Platform analytics |
| GET | `/admin/users` | User search/filter/pagination |
| PATCH | `/admin/users/:userId/role` | Change role and revoke sessions |
| PATCH | `/admin/users/:userId/status` | Activate/suspend/ban and revoke sessions |
| DELETE | `/admin/users/:userId` | Secure removal with obligation checks |
| GET | `/admin/campaigns` | Campaign moderation list |
| POST | `/admin/campaigns/:campaignId/approve` | Approve pending campaign |
| POST | `/admin/campaigns/:campaignId/reject` | Reject with reason |
| POST | `/admin/campaigns/:campaignId/suspend` | Suspend with reason |
| DELETE | `/admin/campaigns/:campaignId` | Refund/delete or archive |
| GET | `/admin/reports` | Report list |
| POST | `/admin/reports/:reportId/resolve` | Resolve report |
| POST | `/admin/reports/:reportId/dismiss` | Dismiss report |
| POST | `/admin/reports/:reportId/action` | Resolve plus suspend/delete campaign |
| GET | `/admin/audit-logs` | Administrative audit history |
| GET | `/admin/withdrawals` | Withdrawal review list |
| POST | `/admin/withdrawals/:withdrawalId/approve` | Record verified settlement |
| POST | `/admin/withdrawals/:withdrawalId/reject` | Reject and restore reserved balance |
| GET | `/admin/finance/summary` | Financial summary |
| GET | `/admin/payments` | Payment records |
| GET | `/admin/ledger` | Immutable wallet ledger view |

All Admin mutations require an active Admin token and `Idempotency-Key`. Self-role/status/removal and final-active-Admin removal are blocked.

## Common errors

| Status | Example code | Meaning |
|---:|---|---|
| 400 | `STRIPE_SIGNATURE_REQUIRED` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired authentication |
| 403 | `FORBIDDEN` | Role/status does not allow action |
| 404 | `CAMPAIGN_NOT_FOUND` | Resource not found or not owned |
| 409 | `CAMPAIGN_NOT_PENDING` | Invalid state transition |
| 422 | `INVALID_DEADLINE` | Validation failed |
| 428 | `IDEMPOTENCY_KEY_REQUIRED` | Required retry key missing |
| 502 | `IMAGE_UPLOAD_FAILED` | Third-party upload failed |
| 503 | `STRIPE_NOT_CONFIGURED` | Optional integration unavailable |

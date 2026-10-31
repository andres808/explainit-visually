# Monthly subscriptions

The app uses hosted Stripe Checkout and the Stripe billing portal. It calls Stripe from the server with native fetch; no Stripe secret reaches the browser. Billing is unavailable until all server settings and persistent storage are supplied. The free learning experience can still run.

Set server environment variables (never NEXT_PUBLIC variables):

| Setting | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Restricted API key from the intended Stripe sandbox or live account, stored as a server secret |
| `STRIPE_PRICE_ID` | One existing active per-unit, licensed, fixed-price subscription Price, recurring every one month |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this deployment's webhook endpoint |
| `BILLING_SESSION_SECRET` | Unique cryptographically random secret, at least 32 characters |
| `APP_URL` | This deployment's trusted HTTPS origin, for example `https://your-site.example` |
| `DB` | Persistent Cloudflare D1 database binding |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Optional app-specific portal configuration ID |
| `BILLING_TEST_MODE` | Set to `true` for public billing tests; test API key prefixes also enforce this restriction |
| `LIVE_GENERATION_OWNER_ID` | Trusted Site-specific owner identity permitted to use real AI providers during billing tests |

The API validates the actual Price through Stripe before showing its amount or creating Checkout. No amount or currency is assumed. Only the server-configured Price ID is accepted. Checkout uses subscription mode, flexible billing, and quantity one. Durable pending attempts and Stripe idempotency reuse an open session for the same signed browser, app, price, and credential. Browser clicks are disabled while opening Stripe. Requests made before the first browser cookie arrives are separate anonymous identities.

Server REST requests pin Stripe API version `2026-10-28.endive`, verified against the [official API versioning reference](https://docs.stripe.com/api/versioning). Configure this webhook endpoint to use that same snapshot API version.

`POST /api/billing/webhook` must be publicly reachable by Stripe, without a site login or redirect. Configure these snapshot event types in Stripe Workbench:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.paid`
- `invoice.payment_failed`

Webhook verification uses HMAC SHA256 of the raw body and the Stripe signature timestamp with a five-minute tolerance. Event IDs persist in D1, and the event insert plus subscription update run atomically to handle repeated deliveries. The handler retrieves the subscription from Stripe, verifies the configured monthly price, and grants access only for an active subscription with a paid latest invoice and an unexpired current period. A canceled subscription or unpaid invoice removes access. A return URL or browser-provided customer ID cannot activate a subscription. Stored access is also bound to the configured Price ID, so changing that setting cannot transfer an old subscription's entitlement to a new plan.

Endpoints:

- `GET /api/billing/status`: `configured`, `active`, `status`, `canManage`, optional `currentPeriodEnd`, and `price: { amount, currency, interval: "month" }`. Amount is in Stripe's minor currency unit. Responses are uncached.
- `POST /api/billing/checkout`: `{ url }` for hosted Checkout, plus a signed HttpOnly SameSite cookie identifying an opaque visitor. Requires an exact same-origin `Origin` header.
- `POST /api/billing/portal`: `{ url }` for the customer already associated with the verified cookie. Requires the same-origin header. No customer ID is accepted from browser input.
- `POST /api/billing/webhook`: Stripe delivery endpoint.

This MVP associates billing with the browser that started Checkout. Keep that browser's cookie to manage its subscription. Cross-device recovery and login-based account linking require a user authentication flow before a public paid launch.

D1 tables and the customer uniqueness index are created on first billing use. The database must permit CREATE TABLE/INDEX. Use persistent backups as appropriate for billing records.

The public hosted test deployment is configured for CA$1.00 monthly in Stripe test mode. Configure your own account, monthly Price, portal configuration, and webhook when deploying a copy. Server secrets are managed separately and excluded from this repository.

Public visitors can explore demos and test billing. A test subscription never authorizes real provider spending: live generation requires the exact trusted signed-in owner identity. An anonymous request cannot spoof that identity through incoming headers. Outside test mode, live generation fails closed unless billing is configured and the browser has an active verified subscription.

The deployed browser flow was verified with Stripe's synthetic card: app checkout → simulated CA$1 payment → signed webhook → active app subscription → customer portal → cancellation of renewal → app return. No real money moved.

For a local Node development server only, `BILLING_LOCAL_STORAGE=true` permits an ignored `.data/billing/store.json` fallback. It is serialized within one Node process and is unsuitable for multiple processes or production. Workers never use this fallback. Local APP_URL may be `http://localhost:3000` or `http://127.0.0.1:3000`; production requires HTTPS.

Before accepting real payments, configure a restricted key and verify its minimum permissions: Prices read (`plan_read`), Checkout Sessions write (`checkout_session_write`), Customer Portal write (`customer_portal_write`), Subscriptions read (`subscription_read`), and Invoices read (`invoice_read`). Verify renewal, payment failure, delayed payment, and duplicate/out-of-order webhook delivery against Stripe; the hosted initial Checkout and portal cancellation checks do not cover those later lifecycle cases. Add handlers that act on `charge.dispute.created`, `charge.refunded`, and `radar.early_fraud_warning.created` before a production subscription launch. Complete account-based recovery and durable provider quotas before permitting public paid generation. Test and live Stripe objects and keys are separate.

Tax collection is not enabled. Review Stripe Tax and applicable registrations before accepting real payments.

Official references: [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), [Price retrieval](https://docs.stripe.com/api/prices/retrieve), [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Webhook verification and duplicate handling](https://docs.stripe.com/events/manage-webhook-endpoints).

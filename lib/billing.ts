import { getRuntimeEnv } from "./runtime-env";

const COOKIE = "explainit_billing";
const SESSION_SECONDS = 60 * 60 * 24 * 365;
const API_VERSION = "2026-10-28.endive";
const INTEGRATION_IDENTIFIER = "explainit-visually-monthly-yemhnxmt";
const CHECKOUT_SESSION_SECONDS = 60 * 60;
// Stripe retains idempotency results for at least 24 hours; stop uncertain retries before that boundary.
const CHECKOUT_KEY_SECONDS = 23 * 60 * 60;
type JsonObject = Record<string, unknown>;
type BillingUser = {
  id: string;
  customer_id: string | null;
  subscription_id: string | null;
  price_id: string | null;
  status: string;
  paid_until: number;
  active: number;
  observed_at: number;
};
type LocalData = {
  users: Record<string, BillingUser>;
  events: Record<string, string>;
  checkouts?: Record<string, PendingCheckout>;
};
type PendingCheckout = {
  scope: string;
  idempotency_key: string;
  request_body: string;
  session_id: string | null;
  created: number;
};
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type Database = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
};
type Config = {
  secretKey: string;
  priceId: string;
  webhookSecret: string;
  sessionSecret: string;
  appUrl: string;
  db?: Database;
  local: boolean;
};

export class BillingError extends Error {
  constructor(
    message: string,
    public status = 503,
    public code = "billing_unavailable",
  ) {
    super(message);
  }
}

function setting(name: string): string {
  const value = getRuntimeEnv()[name] ?? process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function getBillingConfiguration() {
  const db = getRuntimeEnv().DB as Database | undefined;
  const local =
    setting("BILLING_LOCAL_STORAGE") === "true" &&
    process.env.NODE_ENV !== "production" &&
    !getRuntimeEnv().__WORKER_RUNTIME &&
    !getRuntimeEnv().DB;
  const values = {
    STRIPE_SECRET_KEY: setting("STRIPE_SECRET_KEY"),
    STRIPE_PRICE_ID: setting("STRIPE_PRICE_ID"),
    STRIPE_WEBHOOK_SECRET: setting("STRIPE_WEBHOOK_SECRET"),
    BILLING_SESSION_SECRET: setting("BILLING_SESSION_SECRET"),
    APP_URL: setting("APP_URL"),
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (
    values.BILLING_SESSION_SECRET &&
    values.BILLING_SESSION_SECRET.length < 32
  )
    missing.push("BILLING_SESSION_SECRET (at least 32 characters)");
  if (!db && !local) missing.push("DB (persistent billing storage)");
  let appUrl = "";
  try {
    const url = new URL(values.APP_URL);
    if (
      url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.protocol === "http:"
      )
    )
      throw new Error();
    if (url.username || url.password || url.search || url.hash)
      throw new Error();
    appUrl = url.origin;
  } catch {
    if (values.APP_URL) missing.push("APP_URL (valid HTTPS origin)");
  }
  const config: Config = {
    secretKey: values.STRIPE_SECRET_KEY,
    priceId: values.STRIPE_PRICE_ID,
    webhookSecret: values.STRIPE_WEBHOOK_SECRET,
    sessionSecret: values.BILLING_SESSION_SECRET,
    appUrl,
    db,
    local,
  };
  return { configured: missing.length === 0, missing, config };
}

function requireConfig(): Config {
  const result = getBillingConfiguration();
  if (!result.configured)
    throw new BillingError(
      "Monthly billing is awaiting server configuration.",
      503,
      "billing_not_configured",
    );
  return result.config;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
  return Array.from(signature, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

export async function signBillingSession(
  id: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const value = `${id}.${now}`;
  return `${value}.${await hmac(secret, value)}`;
}

export async function verifyBillingSession(
  value: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  const match = /^([a-f0-9-]{36})\.(\d{10})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return null;
  const timestamp = Number(match[2]);
  if (timestamp > now + 60 || now - timestamp > SESSION_SECONDS) return null;
  return constantTimeEqual(
    await hmac(secret, `${match[1]}.${match[2]}`),
    match[3],
  )
    ? match[1]
    : null;
}

export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || rawBody.length > 1_000_000) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamps = parts.filter(([key]) => key === "t");
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0][1] ?? ""))
    return false;
  const timestamp = Number(timestamps[0][1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300)
    return false;
  const expected = await hmac(secret, `${timestamp}.${rawBody}`);
  return parts.some(
    ([key, value]) =>
      key === "v1" &&
      /^[a-f0-9]{64}$/.test(value ?? "") &&
      constantTimeEqual(expected, value),
  );
}

async function visitorId(
  request: Request,
  config: Config,
): Promise<string | null> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE}=`));
  return cookie
    ? verifyBillingSession(
        cookie.slice(COOKIE.length + 1),
        config.sessionSecret,
      )
    : null;
}

function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function objectId(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof record(value).id === "string"
      ? (record(value).id as string)
      : "";
}

async function stripe(
  config: Config,
  path: string,
  data?: URLSearchParams,
  idempotencyKey?: string,
): Promise<JsonObject> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": API_VERSION,
      ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(data && idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(data ? { body: data.toString() } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 409 && idempotencyKey)
    throw new BillingError("Checkout is already being prepared. Please try again shortly.", 409, "checkout_pending");
  if (!response.ok)
    throw new BillingError(
      "Stripe could not complete this billing request. Please try again or contact the site owner.",
      502,
      "stripe_request_failed",
    );
  return record(await response.json());
}

async function monthlyPrice(config: Config) {
  if (!/^price_[A-Za-z0-9]+$/.test(config.priceId))
    throw new BillingError(
      "The monthly Stripe price is not configured correctly.",
    );
  const price = await stripe(
    config,
    `prices/${encodeURIComponent(config.priceId)}`,
  );
  const recurring = record(price.recurring);
  if (
    price.active !== true ||
    price.type !== "recurring" ||
    recurring.interval !== "month" ||
    recurring.interval_count !== 1 ||
    recurring.usage_type !== "licensed" ||
    price.billing_scheme !== "per_unit" ||
    typeof price.unit_amount !== "number"
  ) {
    throw new BillingError(
      "Configure an active, fixed-price monthly Stripe subscription price.",
      503,
      "invalid_monthly_price",
    );
  }
  return {
    amount: price.unit_amount,
    currency: String(price.currency),
    interval: "month" as const,
  };
}

const readyDatabases = new WeakSet<object>();
async function initialize(db: Database) {
  if (readyDatabases.has(db)) return;
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS explainit_billing_users (id TEXT PRIMARY KEY, customer_id TEXT, subscription_id TEXT, price_id TEXT, status TEXT NOT NULL DEFAULT 'none', paid_until INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 0, observed_at INTEGER NOT NULL DEFAULT 0)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS explainit_billing_customer ON explainit_billing_users(customer_id) WHERE customer_id IS NOT NULL",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS explainit_billing_events (id TEXT PRIMARY KEY, token TEXT NOT NULL, created INTEGER NOT NULL)",
    ),
    // A separate table is an additive migration for existing billing databases.
    db.prepare(
      "CREATE TABLE IF NOT EXISTS explainit_billing_checkouts (scope TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL, request_body TEXT NOT NULL, session_id TEXT, created INTEGER NOT NULL)",
    ),
  ]);
  readyDatabases.add(db);
}

let localLock: Promise<unknown> = Promise.resolve();
async function withLocal<T>(
  run: (data: LocalData) => T | Promise<T>,
): Promise<T> {
  const operation = localLock.then(async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const directory = path.join(process.cwd(), ".data", "billing");
    const file = path.join(directory, "store.json");
    await fs.mkdir(directory, { recursive: true });
    let data: LocalData;
    try {
      data = JSON.parse(await fs.readFile(file, "utf8")) as LocalData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      data = { users: {}, events: {} };
    }
    const result = await run(data);
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data), { mode: 0o600 });
    await fs.rename(temp, file);
    return result;
  });
  localLock = operation.catch(() => undefined);
  return operation;
}

async function user(config: Config, id: string): Promise<BillingUser | null> {
  if (config.db) {
    await initialize(config.db);
    return config.db
      .prepare("SELECT * FROM explainit_billing_users WHERE id = ?")
      .bind(id)
      .first<BillingUser>();
  }
  if (config.local) return withLocal((data) => data.users[id] ?? null);
  throw new BillingError("Persistent billing storage is unavailable.");
}

async function createUser(config: Config, id: string) {
  if (config.db) {
    await initialize(config.db);
    await config.db
      .prepare("INSERT OR IGNORE INTO explainit_billing_users (id) VALUES (?)")
      .bind(id)
      .run();
    return;
  }
  if (config.local) {
    await withLocal((data) => {
      data.users[id] ??= {
        id,
        customer_id: null,
        subscription_id: null,
        price_id: null,
        status: "none",
        paid_until: 0,
        active: 0,
        observed_at: 0,
      };
    });
    return;
  }
  throw new BillingError("Persistent billing storage is unavailable.");
}

function activeUser(value: BillingUser | null, priceId: string): boolean {
  return (
    !!value &&
    value.price_id === priceId &&
    value.active === 1 &&
    value.status === "active" &&
    value.paid_until > Date.now() / 1000
  );
}

export async function getBillingEntitlement(request: Request) {
  const configuration = getBillingConfiguration();
  if (!configuration.configured)
    return {
      configured: false,
      active: false,
      status: "unconfigured",
      canManage: false,
    };
  const id = await visitorId(request, configuration.config);
  const existing = id ? await user(configuration.config, id) : null;
  return {
    configured: true,
    active: activeUser(existing, configuration.config.priceId),
    status: existing?.status ?? "none",
    canManage: !!existing?.customer_id,
    currentPeriodEnd: existing?.paid_until || null,
  };
}

export async function billingStatus(request: Request) {
  const configuration = getBillingConfiguration();
  if (!configuration.configured)
    return {
      configured: false,
      active: false,
      status: "unconfigured",
      canManage: false,
      message: "Subscriptions will be available once billing is connected.",
    };
  const price = await monthlyPrice(configuration.config);
  return { ...(await getBillingEntitlement(request)), price };
}

function sameOrigin(request: Request, config: Config) {
  if (request.headers.get("origin") !== config.appUrl)
    throw new BillingError(
      "Open billing from this website.",
      403,
      "invalid_origin",
    );
}

export async function createCheckout(request: Request) {
  const config = requireConfig();
  sameOrigin(request, config);
  await monthlyPrice(config);
  const id = (await visitorId(request, config)) ?? crypto.randomUUID();
  // Two first-ever anonymous requests cannot share an identity until this response's signed cookie arrives.
  // The disabled checkout button guards that browser boundary; subsequent requests share the durable scope below.
  await createUser(config, id);
  const existing = await user(config, id);
  if (
    existing?.subscription_id &&
    !["canceled", "incomplete_expired"].includes(existing.status)
  )
    throw new BillingError(
      "A subscription is already associated with this browser. Use Manage billing.",
      409,
      "already_subscribed",
    );
  const scope = await hmac(config.sessionSecret, JSON.stringify(["checkout-v1", config.secretKey, config.appUrl, config.priceId, id]));
  const result = await coalescedCheckout(scope, () => pendingCheckout(config, scope, id, existing));
  const url = checkoutUrl(result);
  const cookie = `${COOKIE}=${await signBillingSession(id, config.sessionSecret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${config.appUrl.startsWith("https:") ? "; Secure" : ""}`;
  return { url, cookie };
}

function checkoutBody(config: Config, id: string, existing: BillingUser | null, created: number) {
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": config.priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: id,
    "metadata[explainit_visitor_id]": id,
    "subscription_data[metadata][explainit_visitor_id]": id,
    "subscription_data[billing_mode][type]": "flexible",
    integration_identifier: INTEGRATION_IDENTIFIER,
    expires_at: String(created + CHECKOUT_SESSION_SECONDS),
    success_url: `${config.appUrl}/?billing=returned`,
    cancel_url: `${config.appUrl}/?billing=canceled`,
  });
  if (existing?.customer_id) body.set("customer", existing.customer_id);
  return body;
}

function checkoutUrl(result: JsonObject): string {
  try {
    const url = new URL(String(result.url ?? ""));
    if (url.protocol === "https:" && url.hostname === "checkout.stripe.com" && !url.username && !url.password && !url.port) return url.toString();
  } catch { /* Reject malformed provider output. */ }
  throw new BillingError("Stripe did not return a valid checkout page.", 502);
}

const checkoutRequests = new Map<string, Promise<JsonObject>>();
async function coalescedCheckout(scope: string, create: () => Promise<JsonObject>) {
  const running = checkoutRequests.get(scope);
  if (running) return running;
  const operation = create();
  checkoutRequests.set(scope, operation);
  try { return await operation; } finally { if (checkoutRequests.get(scope) === operation) checkoutRequests.delete(scope); }
}

async function reserveCheckout(config: Config, proposal: PendingCheckout, replacingKey?: string): Promise<PendingCheckout> {
  if (config.db) {
    await initialize(config.db);
    if (replacingKey) await config.db.prepare("UPDATE explainit_billing_checkouts SET idempotency_key = ?, request_body = ?, session_id = NULL, created = ? WHERE scope = ? AND idempotency_key = ?").bind(proposal.idempotency_key, proposal.request_body, proposal.created, proposal.scope, replacingKey).run();
    else await config.db.prepare("INSERT OR IGNORE INTO explainit_billing_checkouts (scope, idempotency_key, request_body, session_id, created) VALUES (?, ?, ?, NULL, ?)").bind(proposal.scope, proposal.idempotency_key, proposal.request_body, proposal.created).run();
    const saved = await config.db.prepare("SELECT * FROM explainit_billing_checkouts WHERE scope = ?").bind(proposal.scope).first<PendingCheckout>();
    if (!saved) throw new BillingError("Checkout could not be saved. Please try again.");
    return saved;
  }
  if (config.local) return withLocal(data => {
    data.checkouts ??= {};
    const current = data.checkouts[proposal.scope];
    if (!current || (replacingKey && current.idempotency_key === replacingKey)) data.checkouts[proposal.scope] = proposal;
    return data.checkouts[proposal.scope];
  });
  throw new BillingError("Persistent billing storage is unavailable.");
}

async function saveCheckoutId(config: Config, attempt: PendingCheckout, sessionId: string) {
  if (config.db) {
    await config.db.prepare("UPDATE explainit_billing_checkouts SET session_id = ? WHERE scope = ? AND idempotency_key = ?").bind(sessionId, attempt.scope, attempt.idempotency_key).run();
  } else if (config.local) await withLocal(data => {
    const current = data.checkouts?.[attempt.scope];
    if (current?.idempotency_key === attempt.idempotency_key) current.session_id = sessionId;
  });
}

async function pendingCheckout(config: Config, scope: string, id: string, existing: BillingUser | null, round = 0): Promise<JsonObject> {
  if (round >= 4) throw new BillingError("Checkout is being prepared. Please try again shortly.", 409, "checkout_pending");
  const proposal = () => {
    const created = Math.floor(Date.now() / 1000);
    return { scope, idempotency_key: `explainit-checkout-${crypto.randomUUID()}`, request_body: checkoutBody(config, id, existing, created).toString(), session_id: null, created };
  };
  let attempt = await reserveCheckout(config, proposal());
  // A known session must be inspected even after its local timestamp passes: completed checkouts are never reused.
  if (attempt.session_id) {
    const current = await stripe(config, `checkout/sessions/${encodeURIComponent(attempt.session_id)}`);
    if (current.mode !== "subscription" || current.client_reference_id !== id) throw new BillingError("Checkout ownership could not be verified.", 409, "checkout_mismatch");
    if (current.status === "open" && Number(current.expires_at) > Date.now() / 1000) { checkoutUrl(current); return current; }
    if (current.status === "complete" && !["canceled", "incomplete_expired"].includes(existing?.status ?? "")) throw new BillingError("Checkout is already complete. Billing is updating; use Manage billing or try again shortly.", 409, "checkout_completed");
    if (current.status !== "expired" && !(current.status === "complete" && ["canceled", "incomplete_expired"].includes(existing?.status ?? ""))) throw new BillingError("Checkout is still being updated. Please try again shortly.", 409, "checkout_pending");
    attempt = await reserveCheckout(config, proposal(), attempt.idempotency_key);
    if (attempt.session_id) return pendingCheckout(config, scope, id, existing, round + 1);
  }
  if (Math.floor(Date.now() / 1000) - attempt.created >= CHECKOUT_KEY_SECONDS) throw new BillingError("This checkout attempt needs review before starting another. Contact the site owner.", 409, "checkout_review_required");
  // Persisted exact parameters and key recover an ambiguous timeout without creating a second Stripe session.
  const result = await stripe(config, "checkout/sessions", new URLSearchParams(attempt.request_body), attempt.idempotency_key);
  const sessionId = String(result.id ?? "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new BillingError("Stripe did not return a valid checkout session.", 502);
  await saveCheckoutId(config, attempt, sessionId);
  // Read current state rather than trusting the create response cached by Stripe's idempotency layer.
  return pendingCheckout(config, scope, id, existing, round + 1);
}

export async function createPortal(request: Request) {
  const config = requireConfig();
  sameOrigin(request, config);
  const id = await visitorId(request, config);
  const existing = id ? await user(config, id) : null;
  if (!existing?.customer_id)
    throw new BillingError(
      "No billing account is associated with this browser.",
      401,
      "billing_session_required",
    );
  const body = new URLSearchParams({ customer: existing.customer_id, return_url: config.appUrl });
  const configurationId = setting("STRIPE_PORTAL_CONFIGURATION_ID");
  if (configurationId) {
    if (!/^bpc_[A-Za-z0-9]+$/.test(configurationId)) throw new BillingError("The billing portal configuration is invalid.");
    body.set("configuration", configurationId);
  }
  const result = await stripe(
    config,
    "billing_portal/sessions",
    body,
  );
  const url = String(result.url ?? "");
  if (!url.startsWith("https://billing.stripe.com/"))
    throw new BillingError(
      "Stripe did not return a valid billing portal.",
      502,
    );
  return { url };
}

async function saveEvent(
  config: Config,
  eventId: string,
  value: BillingUser | null,
): Promise<boolean> {
  const token = crypto.randomUUID();
  if (config.db) {
    await initialize(config.db);
    const statements = [
      config.db
        .prepare(
          "INSERT OR IGNORE INTO explainit_billing_events (id, token, created) VALUES (?, ?, ?)",
        )
        .bind(eventId, token, Math.floor(Date.now() / 1000)),
    ];
    if (value)
      statements.push(
        config.db
          .prepare(
            "UPDATE explainit_billing_users SET customer_id = ?, subscription_id = ?, price_id = ?, status = ?, paid_until = ?, active = ?, observed_at = ? WHERE id = ? AND observed_at <= ? AND NOT (subscription_id = ? AND status = 'canceled' AND ? <> 'canceled') AND EXISTS (SELECT 1 FROM explainit_billing_events WHERE id = ? AND token = ?)",
          )
          .bind(
            value.customer_id,
            value.subscription_id,
            value.price_id,
            value.status,
            value.paid_until,
            value.active,
            value.observed_at,
            value.id,
            value.observed_at,
            value.subscription_id,
            value.status,
            eventId,
            token,
          ),
      );
    await config.db.batch(statements);
    const saved = await config.db
      .prepare("SELECT token FROM explainit_billing_events WHERE id = ?")
      .bind(eventId)
      .first<{ token: string }>();
    return saved?.token === token;
  }
  if (config.local)
    return withLocal((data) => {
      if (data.events[eventId]) return false;
      const existing = value ? data.users[value.id] : null;
      if (
        value &&
        existing &&
        (existing.observed_at ?? 0) <= value.observed_at &&
        !(
          existing.subscription_id === value.subscription_id &&
          existing.status === "canceled" &&
          value.status !== "canceled"
        )
      )
        data.users[value.id] = value;
      data.events[eventId] = token;
      return true;
    });
  throw new BillingError("Persistent billing storage is unavailable.");
}

export async function handleBillingWebhook(request: Request) {
  const config = requireConfig();
  if (Number(request.headers.get("content-length")) > 1_000_000)
    throw new BillingError("Webhook payload is too large.", 413);
  const raw = await request.text();
  if (
    !(await verifyStripeSignature(
      raw,
      request.headers.get("stripe-signature"),
      config.webhookSecret,
    ))
  )
    throw new BillingError(
      "Invalid webhook signature.",
      400,
      "invalid_webhook_signature",
    );
  let event: JsonObject;
  try {
    event = record(JSON.parse(raw));
  } catch {
    throw new BillingError("Invalid webhook payload.", 400);
  }
  const type = String(event.type ?? "");
  if (!/^evt_[A-Za-z0-9]+$/.test(String(event.id ?? "")))
    throw new BillingError("Invalid webhook event.", 400);
  const object = record(record(event.data).object);
  const supported = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
    "invoice.paid",
    "invoice.payment_failed",
  ];
  if (!supported.includes(type)) return { received: true, ignored: true };
  const subscriptionId = type.startsWith("customer.subscription.")
    ? objectId(object)
    : objectId(object.subscription) ||
      objectId(record(record(object.parent).subscription_details).subscription);
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId))
    return { received: true, ignored: true };
  // Retrieve current state so a delayed update cannot restore an already-canceled subscription.
  const observedAt = Date.now();
  const subscription = await stripe(
    config,
    `subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=latest_invoice`,
  );
  const metadata = record(subscription.metadata);
  const id = String(
    metadata.explainit_visitor_id ??
      object.client_reference_id ??
      record(object.metadata).explainit_visitor_id ??
      "",
  );
  const existing = /^[a-f0-9-]{36}$/.test(id) ? await user(config, id) : null;
  if (!existing) {
    await saveEvent(config, String(event.id), null);
    return { received: true, ignored: true };
  }
  // A previous subscription's late events cannot replace a newer Checkout association.
  if (
    existing.subscription_id &&
    existing.subscription_id !== subscriptionId &&
    !type.startsWith("checkout.session.")
  ) {
    await saveEvent(config, String(event.id), null);
    return { received: true, ignored: true };
  }
  const customerId = objectId(subscription.customer);
  if (
    !/^cus_[A-Za-z0-9]+$/.test(customerId) ||
    (existing.customer_id && existing.customer_id !== customerId)
  )
    throw new BillingError("Billing customer association does not match.", 400);
  const access = subscriptionAccess(subscription, config.priceId);
  const saved = await saveEvent(config, String(event.id), {
    id,
    customer_id: customerId,
    subscription_id: subscriptionId,
    price_id: config.priceId,
    ...access,
    observed_at: observedAt,
  });
  return { received: true, duplicate: !saved };
}

export function subscriptionAccess(
  subscription: JsonObject,
  priceId: string,
  now = Date.now() / 1000,
) {
  const items = record(subscription.items).data;
  const matchingItems = Array.isArray(items)
    ? items.map(record).filter((item) => {
        const price = record(item.price);
        const recurring = record(price.recurring);
        return (
          objectId(price) === priceId &&
          recurring.interval === "month" &&
          recurring.interval_count === 1
        );
      })
    : [];
  const paid_until = Math.max(
    0,
    ...matchingItems.map(
      (item) =>
        Number(item.current_period_end ?? subscription.current_period_end) || 0,
    ),
  );
  const invoice = record(subscription.latest_invoice);
  const status = String(subscription.status ?? "unknown");
  const active =
    status === "active" &&
    matchingItems.length > 0 &&
    (invoice.paid === true || invoice.status === "paid") &&
    !subscription.pause_collection &&
    paid_until > now
      ? 1
      : 0;
  return { status, paid_until, active };
}

export function billingErrorResponse(error: unknown): Response {
  const known = error instanceof BillingError;
  return Response.json(
    {
      error: known
        ? error.message
        : "Billing is temporarily unavailable. Please try again.",
      code: known ? error.code : "billing_unavailable",
    },
    {
      status: known ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

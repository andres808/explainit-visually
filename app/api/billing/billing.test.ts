import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  billingStatus,
  createCheckout,
  createPortal,
  getBillingConfiguration,
  signBillingSession,
  subscriptionAccess,
  verifyBillingSession,
  verifyStripeSignature,
} from "../../../lib/billing";
import { runWithRuntimeEnv } from "../../../lib/runtime-env";

const secret = "a-unique-test-secret-with-at-least-32-characters";
const now = 1_800_000_000;

test("Stripe signature covers the exact raw body and rejects forged or expired deliveries", async () => {
  const body = '{"id":"evt_valid","data":{"amount":100}}';
  const signature = createHmac("sha256", secret)
    .update(`${now}.${body}`)
    .digest("hex");
  assert.equal(
    await verifyStripeSignature(body, `t=${now},v1=${signature}`, secret, now),
    true,
  );
  assert.equal(
    await verifyStripeSignature(
      body.replace("100", "1"),
      `t=${now},v1=${signature}`,
      secret,
      now,
    ),
    false,
  );
  assert.equal(
    await verifyStripeSignature(
      body,
      `t=${now},v1=${signature}`,
      secret,
      now + 301,
    ),
    false,
  );
  assert.equal(
    await verifyStripeSignature(
      body,
      `t=${now},t=${now},v1=${signature}`,
      secret,
      now,
    ),
    false,
  );
  assert.equal(
    await verifyStripeSignature(
      body,
      `t=${now},v1=${"0".repeat(64)},v1=${signature}`,
      secret,
      now,
    ),
    true,
  );
});

class SqliteStatement {
  private values: SQLInputValue[] = [];
  constructor(private database: DatabaseSync, private sql: string) {}
  bind(...values: unknown[]) { this.values = values as SQLInputValue[]; return this; }
  async first<T>(): Promise<T | null> { return (this.database.prepare(this.sql).get(...this.values) as T | undefined) ?? null; }
  execute() { return this.database.prepare(this.sql).run(...this.values); }
  async run() { return this.execute(); }
}
class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) { return new SqliteStatement(this.sqlite, sql); }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.execute()); this.sqlite.exec("COMMIT"); return results; }
    catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

function checkoutFixture() {
  const db = new SqliteD1();
  const sessions = new Map<string, Record<string, unknown>>();
  const byKey = new Map<string, { body: string; initial: Record<string, unknown> }>();
  const posts: { key: string; body: URLSearchParams }[] = [];
  let loseResponse = false;
  let portalBody = new URLSearchParams();
  const environment = { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_PRICE_ID: "price_monthly", STRIPE_WEBHOOK_SECRET: "whsec_fixture", BILLING_SESSION_SECRET: secret, APP_URL: "https://example.com", DB: db };
  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input);
    if (url.includes("/prices/")) return Response.json({ active: true, type: "recurring", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, billing_scheme: "per_unit", unit_amount: 100, currency: "cad" });
    if (url.endsWith("/billing_portal/sessions")) { portalBody = new URLSearchParams(String(options?.body)); return Response.json({ url: "https://billing.stripe.com/p/session_test" }); }
    if (url.endsWith("/checkout/sessions")) {
      const key = new Headers(options?.headers).get("Idempotency-Key")!;
      assert.ok(key, "Checkout creation must be idempotent");
      const body = new URLSearchParams(String(options?.body)); posts.push({ key, body });
      let stored = byKey.get(key);
      if (stored) assert.equal(body.toString(), stored.body, "Stripe idempotency requires exact request replay");
      else {
        const id = `cs_test_${sessions.size + 1}`;
        const initial = { id, mode: "subscription", client_reference_id: body.get("client_reference_id"), status: "open", expires_at: Number(body.get("expires_at")), url: `https://checkout.stripe.com/c/pay/${id}` };
        sessions.set(id, { ...initial }); stored = { body: body.toString(), initial }; byKey.set(key, stored);
      }
      if (loseResponse) { loseResponse = false; throw new TypeError("Connection lost after Stripe created the session"); }
      return Response.json(stored.initial);
    }
    const id = url.split("/").at(-1)!;
    assert.ok(sessions.has(id), `Unexpected mocked Stripe request: ${url}`);
    return Response.json(sessions.get(id));
  };
  return { db, sessions, posts, environment, fetcher, loseNextResponse: () => { loseResponse = true; }, get portalBody() { return portalBody; } };
}

async function checkoutRequest(id: string) {
  return new Request("https://example.com/api/billing/checkout", { method: "POST", headers: { origin: "https://example.com", cookie: `explainit_billing=${await signBillingSession(id, secret)}` } });
}

test("real SQLite pending checkout survives repeated and concurrent clicks and adds compatible subscription parameters", async () => {
  const original = globalThis.fetch; const fixture = checkoutFixture(); globalThis.fetch = fixture.fetcher;
  const id = crypto.randomUUID();
  try {
    await runWithRuntimeEnv(fixture.environment, async () => {
      const [first, second] = await Promise.all([createCheckout(await checkoutRequest(id)), createCheckout(await checkoutRequest(id))]);
      assert.equal(first.url, second.url); assert.equal(fixture.posts.length, 1);
      const repeated = await createCheckout(await checkoutRequest(id)); assert.equal(repeated.url, first.url); assert.equal(fixture.posts.length, 1);
      const body = fixture.posts[0].body;
      assert.match(body.get("integration_identifier")!, /^explainit-visually-monthly-[a-z]{8}$/);
      assert.equal(body.get("subscription_data[billing_mode][type]"), "flexible");
      assert.equal(body.has("payment_method_types"), false);
      assert.equal(body.get("line_items[0][price]"), "price_monthly");
      assert.ok(Number(body.get("expires_at")) > Date.now() / 1000 + 1800);
      const rows = fixture.db.sqlite.prepare("SELECT * FROM explainit_billing_checkouts").all();
      assert.equal(rows.length, 1); assert.match(String(rows[0].scope), /^[a-f0-9]{64}$/);
      assert.ok(first.cookie.includes("HttpOnly")); assert.ok(first.cookie.includes("Secure"));
    });
  } finally { globalThis.fetch = original; fixture.db.sqlite.close(); }
});

test("lost Checkout responses replay the durable key and exact parameters; completed sessions cannot be reused", async () => {
  const original = globalThis.fetch; const fixture = checkoutFixture(); globalThis.fetch = fixture.fetcher;
  const id = crypto.randomUUID();
  try {
    await runWithRuntimeEnv(fixture.environment, async () => {
      fixture.loseNextResponse(); await assert.rejects(createCheckout(await checkoutRequest(id)), /Connection lost/);
      const recovered = await createCheckout(await checkoutRequest(id));
      assert.ok(recovered.url.includes("cs_test_1")); assert.equal(fixture.sessions.size, 1); assert.equal(fixture.posts.length, 2); assert.equal(fixture.posts[0].key, fixture.posts[1].key);
      fixture.sessions.get("cs_test_1")!.status = "complete";
      await assert.rejects(createCheckout(await checkoutRequest(id)), /already complete/); assert.equal(fixture.posts.length, 2);
    });
  } finally { globalThis.fetch = original; fixture.db.sqlite.close(); }
});

test("only Stripe-confirmed expiration rotates the checkout key; uncertain keys stop before Stripe retention expires", async () => {
  const original = globalThis.fetch; const fixture = checkoutFixture(); globalThis.fetch = fixture.fetcher;
  const id = crypto.randomUUID();
  try {
    await runWithRuntimeEnv(fixture.environment, async () => {
      await createCheckout(await checkoutRequest(id)); fixture.sessions.get("cs_test_1")!.status = "expired";
      await createCheckout(await checkoutRequest(id)); assert.equal(fixture.posts.length, 2); assert.notEqual(fixture.posts[0].key, fixture.posts[1].key);
      fixture.db.sqlite.prepare("UPDATE explainit_billing_checkouts SET session_id = NULL, created = ?").run(Math.floor(Date.now() / 1000) - 23 * 3600 - 1);
      await assert.rejects(createCheckout(await checkoutRequest(id)), /needs review/); assert.equal(fixture.posts.length, 2);
    });
  } finally { globalThis.fetch = original; fixture.db.sqlite.close(); }
});

test("additive pending schema preserves prior users and app-specific portal configuration is passed to Stripe", async () => {
  const original = globalThis.fetch; const fixture = checkoutFixture(); globalThis.fetch = fixture.fetcher;
  const id = crypto.randomUUID();
  fixture.db.sqlite.exec("CREATE TABLE explainit_billing_users (id TEXT PRIMARY KEY, customer_id TEXT, subscription_id TEXT, price_id TEXT, status TEXT NOT NULL DEFAULT 'none', paid_until INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 0, observed_at INTEGER NOT NULL DEFAULT 0)");
  fixture.db.sqlite.prepare("INSERT INTO explainit_billing_users (id, customer_id, observed_at) VALUES (?, ?, ?)").run(id, "cus_existing", 123);
  try {
    await runWithRuntimeEnv({ ...fixture.environment, STRIPE_PORTAL_CONFIGURATION_ID: "bpc_appspecific" }, async () => {
      await createCheckout(await checkoutRequest(id));
      assert.equal(fixture.db.sqlite.prepare("SELECT observed_at FROM explainit_billing_users WHERE id = ?").get(id)?.observed_at, 123);
      await createPortal(await checkoutRequest(id)); assert.equal(fixture.portalBody.get("configuration"), "bpc_appspecific"); assert.equal(fixture.portalBody.get("customer"), "cus_existing");
    });
  } finally { globalThis.fetch = original; fixture.db.sqlite.close(); }
});

test("checkout attempt keys cannot cross configured prices or Stripe credentials", async () => {
  const original = globalThis.fetch; const fixture = checkoutFixture(); globalThis.fetch = fixture.fetcher;
  const id = crypto.randomUUID();
  try {
    await runWithRuntimeEnv(fixture.environment, async () => { await createCheckout(await checkoutRequest(id)); });
    await runWithRuntimeEnv({ ...fixture.environment, STRIPE_PRICE_ID: "price_alternate" }, async () => { await createCheckout(await checkoutRequest(id)); });
    await runWithRuntimeEnv({ ...fixture.environment, STRIPE_SECRET_KEY: "sk_test_otherfixture" }, async () => { await createCheckout(await checkoutRequest(id)); });
    assert.equal(fixture.posts.length, 3); assert.equal(new Set(fixture.posts.map(post => post.key)).size, 3);
    assert.equal(fixture.posts[1].body.get("line_items[0][price]"), "price_alternate");
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS count FROM explainit_billing_checkouts").get()?.count, 3);
  } finally { globalThis.fetch = original; fixture.db.sqlite.close(); }
});

test("billing session authenticates opaque ID and refuses tampering, wrong key, and expiration", async () => {
  const id = "c2634e58-6e62-4d9a-bf51-656de93701f8";
  const value = await signBillingSession(id, secret, now);
  assert.equal(await verifyBillingSession(value, secret, now), id);
  assert.equal(
    await verifyBillingSession(value.replace("c263", "c264"), secret, now),
    null,
  );
  assert.equal(await verifyBillingSession(value, "wrong-secret", now), null);
  assert.equal(
    await verifyBillingSession(value, secret, now + 366 * 86400),
    null,
  );
});

test("unconfigured billing never grants access from a browser success parameter", async () => {
  await runWithRuntimeEnv({}, async () => {
    const configuration = getBillingConfiguration();
    assert.equal(configuration.configured, false);
    assert.ok(configuration.missing.includes("STRIPE_SECRET_KEY"));
    const request = new Request(
      "https://example.com/api/billing/status?paid=true&billing=success&customer=cus_forged",
    );
    assert.deepEqual(await billingStatus(request), {
      configured: false,
      active: false,
      status: "unconfigured",
      canManage: false,
      message: "Subscriptions will be available once billing is connected.",
    });
    await assert.rejects(
      createCheckout(
        new Request("https://example.com/api/billing/checkout", {
          method: "POST",
          headers: { origin: "https://example.com" },
        }),
      ),
      /awaiting server configuration/,
    );
  });
});

test("Workers require persistent DB even if a local-storage switch is set", async () => {
  runWithRuntimeEnv({ BILLING_LOCAL_STORAGE: "true" }, () => {
    assert.ok(
      getBillingConfiguration().missing.includes(
        "DB (persistent billing storage)",
      ),
    );
  });
});

test("webhook entitlement requires the configured monthly price, paid invoice, active status and current period", () => {
  const subscription = {
    status: "active",
    latest_invoice: { status: "paid" },
    items: {
      data: [
        {
          price: {
            id: "price_monthly",
            recurring: { interval: "month", interval_count: 1 },
          },
          current_period_end: now + 3600,
        },
      ],
    },
  };
  assert.equal(
    subscriptionAccess(subscription, "price_monthly", now).active,
    1,
  );
  assert.equal(
    subscriptionAccess(subscription, "price_attacker", now).active,
    0,
  );
  assert.equal(
    subscriptionAccess(
      { ...subscription, latest_invoice: { status: "open" } },
      "price_monthly",
      now,
    ).active,
    0,
  );
  assert.equal(
    subscriptionAccess(
      { ...subscription, status: "canceled" },
      "price_monthly",
      now,
    ).active,
    0,
  );
  assert.equal(
    subscriptionAccess(subscription, "price_monthly", now + 3601).active,
    0,
  );
  const annual = {
    ...subscription,
    items: {
      data: [
        {
          price: {
            id: "price_monthly",
            recurring: { interval: "year", interval_count: 1 },
          },
          current_period_end: now + 3600,
        },
      ],
    },
  };
  assert.equal(subscriptionAccess(annual, "price_monthly", now).active, 0);
});

test("Checkout rejects an annual server price before issuing a payment session and ignores browser price input", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({
      active: true,
      type: "recurring",
      recurring: {
        interval: "year",
        interval_count: 1,
        usage_type: "licensed",
      },
      billing_scheme: "per_unit",
      unit_amount: 1000,
      currency: "usd",
    });
  };
  try {
    await runWithRuntimeEnv(
      {
        STRIPE_SECRET_KEY: "sk_test_mock",
        STRIPE_PRICE_ID: "price_server",
        STRIPE_WEBHOOK_SECRET: "whsec_mock",
        BILLING_SESSION_SECRET: secret,
        APP_URL: "https://example.com",
        DB: {},
      },
      async () => {
        const request = new Request(
          "https://example.com/api/billing/checkout",
          {
            method: "POST",
            headers: {
              origin: "https://example.com",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              priceId: "price_browser",
              customerId: "cus_browser",
            }),
          },
        );
        await assert.rejects(createCheckout(request), /fixed-price monthly/);
        assert.deepEqual(requests, [
          "https://api.stripe.com/v1/prices/price_server",
        ]);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
